[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)

# Review Platform

This GitHub repo contains a rating and recommendation platform designed to help people discover, review, and evaluate all kinds of games that align with their preferences. The application provides features like multi-metric 5-star game ratings, detailed reviews, and AI-powered personalized recommendations. With user account creation, gamers can bookmark favorites, track their reviews, and explore trending games across genres. This platform is different from competitors because of its tailored recommendations, robust user profiles, and interactive community-driven reviews.

## Screenshots

![Backend Diagram](diagrams/joystickjournal.drawio.png)

## Run Locally

Clone the project

Add .env file into server/application directory. Request project admin for .env keys.

```bash
  git clone https://github.com/CSC-648-SFSU/csc648-01-fa24-team02.git
```

Go to the project directory

```bash
  cd my-project
```

Install dependencies for back end

```bash
  cd application/server
```

```bash
  npm install
```

Start the server in development mode

```bash
  npm run dev
```

Start the server in production mode

```bash
  npm run build
```

```bash
  npm run start
```

## Add sample data

Download SQL and configure

add proper .env keys

```bash
DEV_HOST=127.0.0.1
DEV_USER_STRING=user
DEV_PASSWORD=password
DEV_DATABASE=databasename
```

```bash
  npm run db
```

## Running Tests

To run tests, run the following command inside of application/server

```bash
  npm run test
```
