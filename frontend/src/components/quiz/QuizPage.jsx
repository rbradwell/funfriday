import {React, useState, useEffect} from 'react';
import { useSearchParams } from "react-router-dom";
import { useNavigate } from 'react-router-dom';
import FinalScores from './scores/FinalScores';
import ErrorPanel from '../common/ErrorPanel';
import StartQuiz from './StartQuiz';
import QuestionView from './questions/QuestionView';

function QuizPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState()
  const [socket, setSocket] = useState(null);
  const [partyId, setPartyId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [submittedAnswer, setSubmittedAnswer] = useState(null);
  const [searchParams] = useSearchParams();
  const [scores, setScores] = useState(null);
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(null);
  const [userId, setUserId] = useState(null);
  const [creatorId, setCreatorId] = useState(null);

  useEffect(() => {
    const partyIdFromUrl = searchParams.get("party_id");
    const userIdFromUrl = searchParams.get("user_id");
    if (!partyIdFromUrl) {
      setError("Party ID is missing.");
      setLoading(false);
      return;
    }
    if (partyIdFromUrl) {
      setPartyId(partyIdFromUrl);
    }
    if (userIdFromUrl) {
      setUserId(userIdFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    let timer;
    if (currentQuestion && currentQuestion.timeout) {
      setTimeLeft(currentQuestion.timeout);
      timer = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }

    return () => {
      clearInterval(timer);
    };
  }, [currentQuestion]);

  useEffect(() => {
    if (partyId) {
      // TODO - handle websocket connection errors and reconnect
      const playerId = localStorage.getItem('playerId');
      const websocket = new WebSocket(`ws://localhost:8000/ws/${partyId}?user_id=${playerId}`);

      websocket.onopen = () => {
        console.log('WebSocket connection opened');
      };

      websocket.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        const quizData = JSON.parse(event.data);
        if (quizData.event === "new_question") {
          setCurrentQuestion({
            question: quizData.question,
            choices: quizData.choices,
            timeout: quizData.timeout
          });
          setLoading(false);
          setSelectedChoice(null);
          setSubmittedAnswer(null);
          setTimeLeft(quizData.timeout);
        } else if (quizData.event === "game_over") {
          setScores(quizData.scores);
          setLoading(false);
          setTimeLeft(null);
          setTimeout(() => {
            navigate(`/`); // Redirect to LobbyPage
          }, 5000);
        }
        setLoading(false);
      };

      websocket.onerror = (event) => {
        setError('WebSocket error occurred');
      };
      setSocket(websocket);
      return () => {
        if (websocket) {
          console.log('WebSocket connection closed');
          websocket.close();
        }
      };
    }
  }, [partyId]);

  useEffect(() => {
    if (partyId) {
      const fetchCreatorId = async () => {
        try {
          const response = await fetch(`/api/party/${partyId}`);
          const data = await response.json();
          setCreatorId(data.creator_id); // Assume the API returns the creator's ID
        } catch (error) {
          console.error("Failed to fetch creator ID:", error);
          setError("Failed to fetch creator ID.");
        }
      };

      fetchCreatorId();
    }
  }, [partyId]);

  const handleChoiceClick = (choice) => {
    if (!submittedAnswer) {
      setSelectedChoice(choice);
    }
  };

  const handleSubmitAnswer = () => {
    if (socket && selectedChoice) {
      console.log('sending answer selectedChoice', selectedChoice, 'to websocket with partyId', partyId);
      const playerId = localStorage.getItem('playerId');
      socket.send(
        JSON.stringify({
          event: "answer",
          answer: selectedChoice,
          user_id: playerId,
          party_id: partyId
        })
      );
      setSubmittedAnswer(true);
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

  if (error) {
    return <ErrorPanel error={error} />;
  }

  if (loading) {
    return (
      <StartQuiz
        userId={userId}
        creatorId={creatorId}
        onStartGame={handleStartGame}
      />
    );
  }

  if (scores) {
    return (
      <FinalScores scores={scores} />
    );
  }

  return (
    <QuestionView
      currentQuestion={currentQuestion}
      timeLeft={timeLeft}
      selectedChoice={selectedChoice}
      submittedAnswer={submittedAnswer}
      handleChoiceClick={handleChoiceClick}
      handleSubmitAnswer={handleSubmitAnswer}
    />
  );
}

export default QuizPage;