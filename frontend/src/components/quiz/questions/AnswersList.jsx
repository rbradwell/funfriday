import React from 'react';
import Answer from './Answer';

function AnswersList({ choices, selectedChoice, submittedAnswer, handleChoiceClick }) {
  return (
    <ul style={{ listStyleType: "none", padding: 0 }}>
      {choices.map((choice, index) => (
        <Answer
          key={index}
          choice={choice}
          selectedChoice={selectedChoice}
          submittedAnswer={submittedAnswer}
          handleChoiceClick={handleChoiceClick}
        />
      ))}
    </ul>
  );
}

export default AnswersList; 