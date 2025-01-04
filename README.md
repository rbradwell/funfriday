# A multiperson quiz app

## Running the backend

From the root directory run the command `docker compose up` </br></br>

## Running the frontend

Unfortunately the frontend hasn't been dockerized yet. From the root directory issue the commands

- `cd frontend`
- `npm install`
- `npm run dev`

The app should be available @ http://localhost:5173/

Currently there is a temporary solution to logging into the app that requires work. When the user logs in the user id is stored in local storage. When restarting the app clear the appropriate local storage in the browser.
