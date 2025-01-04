import {React, useState, useEffect} from 'react';
import { useSearchParams } from "react-router-dom";
import { useNavigate } from 'react-router-dom';
import FinalScores from './scores/FinalScores';
import ErrorPanel from '../common/ErrorPanel';
import StartQuiz from './StartQuiz';
import QuestionView from './questions/QuestionView';

function QuizPage() {
  const [pageState, setPageState] = useState({
    loading: true,
    error: null,
  });

  const [partyConfig, setPartyConfig] = useState({
    partyId: null,
    userId: null,
    creatorId: null,
  });

  const [quizState, setQuizState] = useState({
    currentQuestion: null,
    selectedChoice: null,
    submittedAnswer: null,
    timeLeft: null,
    scores: null,
  });

  const [socket, setSocket] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const partyIdFromUrl = searchParams.get("party_id");
    const userIdFromUrl = searchParams.get("user_id");
    if (!partyIdFromUrl) {
      setPageState({
        ...pageState,
        error: "Party ID is missing.",
        loading: false,
      });
      return;
    }
    if (partyIdFromUrl) {
      setPartyConfig((prevConfig) => ({
        ...prevConfig,
        partyId: partyIdFromUrl,
      }));
    }
    if (userIdFromUrl) {
      setPartyConfig((prevConfig) => ({
        ...prevConfig,
        userId: userIdFromUrl,
      }));
    }
  }, [searchParams]);

  useEffect(() => {
    let timer;
    if (quizState.currentQuestion && quizState.currentQuestion.timeout) {
      setQuizState({
        ...quizState,
        timeLeft: quizState.currentQuestion.timeout,
      });
      timer = setInterval(() => {
        setQuizState((prevState) => ({
          ...prevState,
          timeLeft: prevState.timeLeft <= 1 ? 0 : prevState.timeLeft - 1,
        }));
        if (quizState.timeLeft <= 1) {
          clearInterval(timer);
        }
      }, 1000);
    }

    return () => {
      clearInterval(timer);
    };
  }, [quizState.currentQuestion]);

  useEffect(() => {
    if (partyConfig.partyId) {
      // TODO - handle websocket connection errors and reconnect
      const playerId = localStorage.getItem('playerId');
      const websocket = new WebSocket(`ws://localhost:8000/ws/${partyConfig.partyId}?user_id=${playerId}`);

      websocket.onopen = () => {
        console.log('WebSocket connection opened');
      };

      websocket.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        const quizData = JSON.parse(event.data);
        if (quizData.event === "new_question") {
          setQuizState({
            ...quizState,
            currentQuestion: {
              question: quizData.question,
              choices: quizData.choices,
              timeout: quizData.timeout
            },
            loading: false,
            selectedChoice: null,
            submittedAnswer: null,
            timeLeft: quizData.timeout,
          });
        } else if (quizData.event === "game_over") {
          setQuizState({
            ...quizState,
            scores: quizData.scores,
            loading: false,
            timeLeft: null,
          });
          setTimeout(() => {
            navigate(`/`); // Redirect to LobbyPage
          }, 5000);
        }
        setPageState({
          ...pageState,
          loading: false,
        });
      };

      websocket.onerror = (event) => {
        setPageState({
          ...pageState,
          error: 'WebSocket error occurred',
        });
      };
      setSocket(websocket);
      return () => {
        if (websocket) {
          console.log('WebSocket connection closed');
          websocket.close();
        }
      };
    }
  }, [partyConfig.partyId]);

  useEffect(() => {
    if (partyConfig.partyId) {
      const fetchCreatorId = async () => {
        try {
          const response = await fetch(`/api/party/${partyConfig.partyId}`);
          const data = await response.json();
          setPartyConfig((prevConfig) => ({
            ...prevConfig,
            creatorId: data.creator_id,
          }));
        } catch (error) {
          console.error("Failed to fetch creator ID:", error);
          setPageState({
            ...pageState,
            error: "Failed to fetch creator ID.",
          });
        }
      };

      fetchCreatorId();
    }
  }, [partyConfig.partyId]);

  const handleChoiceClick = (choice) => {
    if (!quizState.submittedAnswer) {
      setQuizState({
        ...quizState,
        selectedChoice: choice,
      });
    }
  };

  const handleSubmitAnswer = () => {
    if (socket && quizState.selectedChoice) {
      console.log('sending answer selectedChoice', quizState.selectedChoice, 'to websocket with partyId', partyConfig.partyId);
      const playerId = localStorage.getItem('playerId');
      socket.send(
        JSON.stringify({
          event: "answer",
          answer: quizState.selectedChoice,
          user_id: playerId,
          party_id: partyConfig.partyId
        })
      );
      setQuizState({
        ...quizState,
        submittedAnswer: true,
      });
    }
  };

  const handleStartGame = async () => {
    console.log('starting game');
    const queryParams = new URLSearchParams(location.search);
    const partyId = queryParams.get('party_id');
    const playerId = localStorage.getItem('playerId');

    if (socket) {
      console.log('sending start_game event');
      socket.send(
        JSON.stringify({
          event: "start_game",
          user_id: playerId,
          party_id: partyId
        })
      );
    }

  };

  if (pageState.error) {
    return <ErrorPanel error={pageState.error} />;
  }

  if (pageState.loading) {
    return (
      <StartQuiz
        partyConfig={partyConfig}
        onStartGame={handleStartGame}
      />
    );
  }

  if (quizState.scores) {
    return (
      <FinalScores scores={quizState.scores} />
    );
  }

  return (
    <QuestionView
      quizState={quizState}
      handleChoiceClick={handleChoiceClick}
      handleSubmitAnswer={handleSubmitAnswer}
    />
  );
}

export default QuizPage;