import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GameCreationPage from './components/GameCreationPage';
import QuizPage from './components/QuizPage';
import LobbyPage from './components/LobbyPage';
function App() {
    return (
            <Router>
                <Routes>
                    <Route path="/" element={<LobbyPage />} />
                    <Route path="/create" element={<GameCreationPage />} />
                    <Route path="/quiz" element={<QuizPage />} />
                </Routes>
            </Router>
    );
}

export default App;
