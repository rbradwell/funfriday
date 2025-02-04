import React from 'react';
import AnswersList from './AnswersList';

function QuestionView({ quizState, handleChoiceClick, handleSubmitAnswer }) {
  console.log('In question view', quizState);
  const { currentQuestion, timeLeft, selectedChoice, submittedAnswer } = quizState;

  return (
    <main>
      <section className="container">
        <br/><br/>
        <h3>{currentQuestion.question}</h3>
        {timeLeft !== null && (
          <p>Time left: {timeLeft} seconds</p>
        )}
        <AnswersList
          choices={currentQuestion.choices}
          selectedChoice={selectedChoice}
          submittedAnswer={submittedAnswer}
          handleChoiceClick={handleChoiceClick}
        />
        {submittedAnswer ? (
          <p>You answered: <strong>{selectedChoice}</strong></p>
        ) : (
          <button
            type="button"
            className="btn btn-block"
            onClick={() => handleSubmitAnswer()}
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