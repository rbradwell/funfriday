import React, { useRef } from 'react';

function UserLogin({ onLogin }) {
    const playerNameRef = useRef(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        const playerName = playerNameRef.current.value;
        if (playerName) {
            onLogin(playerName);
        }
    };

    return (
        <form onSubmit={handleLogin}>
            <label>
                Player ID:
                <input
                    type="text"
                    ref={playerNameRef}
                    required
                />
            </label>
            <br /><br />
            <button type="submit">Login</button>
        </form>
    );
}

export default UserLogin; 