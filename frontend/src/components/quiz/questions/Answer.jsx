import React from 'react';

function Answer({ choice, selectedChoice, submittedAnswer, handleChoiceClick }) {
    return (
      <li
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
    );
  }

  export default Answer;