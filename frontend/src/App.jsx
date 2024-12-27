import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GameCreationPage from './components/GameCreationPage';
import QuestionsPage from './components/QuestionsPage';
import LobbyPage from './components/LobbyPage';
function App() {
    return (
            <Router>
                <Routes>
                    <Route path="/" element={<LobbyPage />} />
                    <Route path="/create" element={<GameCreationPage />} />
                    <Route path="/questions" element={<QuestionsPage />} />
                </Routes>
            </Router>
    );
}

export default App;
