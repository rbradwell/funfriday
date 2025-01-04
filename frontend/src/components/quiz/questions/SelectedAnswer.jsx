import React from 'react';

function SelectedAnswer({ selectedChoice, submittedAnswer, handleSubmitAnswer }) {
  return (
    submittedAnswer ? (
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
    )
  );
}

export default SelectedAnswer; 