import React from 'react';

function QuestionInfo({ question, timeLeft }) {
  return (
    <>
      <h3>{question}</h3>
      {timeLeft !== null && (
        <p>Time left: {timeLeft} seconds</p>
      )}
    </>
  );
}

export default QuestionInfo; 