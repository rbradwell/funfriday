import React from 'react';

function StartQuiz({ userId, creatorId, onStartGame }) {
  return (
    <div>
      <p style={{ color: "blue", marginBottom: "20px" }}>
        Waiting for game to start!
      </p>
      {userId === creatorId && (
        <button onClick={onStartGame} className="btn btn-block">
          Start Game
        </button>
      )}
    </div>
  );
}

export default StartQuiz; 