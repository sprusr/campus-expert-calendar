# Campus Expert Calendar

A [probot](https://github.com/probot/probot) GitHub App that reads events from issues and adds them to a Google Calendar.

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

In your repo's `.github/calendar.yml`:
```yaml
regex: \d{4}-\d{2}-\d{2}$ # regex to match date in title
format: YYYY-MM-DD # format of the above, for use with moment.js
gcal_calendar: id_goes_here # instructions in issue posted when app is added to repo
gcal_token: encrypted_token_here # same here
```

Required GitHub App permissions:

* Issues: read & write
* Single file: read-only, path: `.github/calendar.yml`
* Events: Issues, Issue comment

More info [here](https://probot.github.io/docs/deployment/).
