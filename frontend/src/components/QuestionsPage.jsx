import {React, useState, useEffect} from 'react';
import { useSearchParams } from "react-router-dom";
import axios from 'axios';

function QuestionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState()
  const [socket, setSocket] = useState(null);
  const [partyId, setPartyId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [submittedAnswer, setSubmittedAnswer] = useState(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const partyIdFromUrl = searchParams.get("party_id");
    if (!partyIdFromUrl) {
      console.log('partyId is missing');
      setError("Party ID is missing.");
      setLoading(false);
      return;
    }
    if (partyIdFromUrl) {
      setPartyId(partyIdFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    if (partyId) {
      // TODO - handle websocket connection errors and reconnect
      const websocket = new WebSocket(`ws://localhost:8000/ws/${partyId}`);

      websocket.onopen = () => {
        console.log('WebSocket connection opened');
      };

      websocket.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        const quizData = JSON.parse(event.data);
        if (quizData.event === "new_question") {
          setCurrentQuestion({
            question: quizData.question,
            choices: quizData.choices
          });
          setLoading(false);
          setSelectedChoice(null);
          setSubmittedAnswer(null);
        }
        setLoading(false);
      };

      websocket.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket error occurred');
      };
      console.log('setting websocket', websocket);
      setSocket(websocket);
      return () => {
        if (websocket) {
          console.log('WebSocket connection closed');
          websocket.close();
        }
      };
    }
  }, [partyId]);

  const handleChoiceClick = (choice) => {
    setSelectedChoice(choice);
  };

  const handleSubmitAnswer = () => {
    console.log('answer', selectedChoice);
    if (socket && selectedChoice) {
      console.log('sending answer event');
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
    return (
      <div style={{ color: "red", padding: "10px", border: "1px solid red" }}>
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <p style={{ color: "blue", marginBottom: "20px" }}>
          Waiting for game to start!
        </p>
        <button onClick={handleStartGame} className="btn btn-block">
          Start Game
        </button>
      </div>
    );
  }

  return (
    <main>
      <section className="container">
        <h3>{currentQuestion.question}</h3>
        <ul style={{ listStyleType: "none", padding: 0 }}>
          {currentQuestion.choices.map((choice, index) => (
            <li
              key={index}
              onClick={() => handleChoiceClick(choice)}
              style={{
                cursor: "pointer",
                padding: "10px",
                margin: "5px 0",
                border: selectedChoice === choice ? "2px solid #4caf50" : "1px solid #ccc",
                borderRadius: "5px",
              }}
            >
              {choice}
            </li>
          ))}
        </ul>
        {submittedAnswer ? (
          <p>You answered: {submittedAnswer}</p>
        ) : (
          <button
            type="button"
            className="btn btn-block"
            onClick={handleSubmitAnswer}
            disabled={!selectedChoice}
          >
            Submit Answer
          </button>
        )}
      </section>
    </main>
  );
}

export default QuestionsPage;