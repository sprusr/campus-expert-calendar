# Campus Expert Calendar

A [probot](https://github.com/probot/probot) GitHub App that reads events from issues and adds them to a Google Calendar.

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

Required GitHub App permissions:

* Issues: read & write
* Single file: read-only, path: `.github/calendar.yml`
* Events: Issues, Issue comment

More info [here](https://probot.github.io/docs/deployment/).
