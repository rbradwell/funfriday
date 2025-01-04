import React from 'react';

function QuestionView({ currentQuestion, timeLeft, selectedChoice, submittedAnswer, handleChoiceClick, handleSubmitAnswer }) {
  return (
    <main>
      <section className="container">
        <br/><br/>
        <h3>{currentQuestion.question}</h3>
        {timeLeft !== null && (
          <p>Time left: {timeLeft} seconds</p>
        )}
        <ul style={{ listStyleType: "none", padding: 0 }}>
          {currentQuestion.choices.map((choice, index) => (
            <li
              key={index}
              onClick={() => handleChoiceClick(choice)}
              style={{
                cursor: submittedAnswer ? "default" : "pointer",
                padding: "10px",
                margin: "5px 0",
                border: selectedChoice === choice && !submittedAnswer ? "2px solid #4caf50" : "1px solid #ccc",
                borderRadius: "5px",
              }}
            >
              {choice}
            </li>
          ))}
        </ul>
        {submittedAnswer ? (
          <p>You answered: <strong>{selectedChoice}</strong></p>
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

export default QuestionView; 