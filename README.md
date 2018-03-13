<div align="center">
  <img alt="Campus Expert Calendar logo" src="https://avatars2.githubusercontent.com/in/9896?s=88&v=4">
  <h3><a href="https://github.com/apps/campus-expert-calendar">Campus Expert Calendar</a></h3>
  <p>A <a href="https://github.com/probot/probot">Probot</a> app that reads events from issues and adds them to a Google Calendar. Created for use within <a href="https://githubcampus.expert/">Campus Experts</a>.</p>
</div>

## Use

When you install the app, CE Calendar will post an issue on all installed repos prompting you to carry out the additional setup steps. These consist of:

1. Authing with Google Calendar
2. Commenting on the issue with the generated code
3. Finding the ID of the calendar you want to add events to
4. Setting up your `.github/calendar.yml` config file

After these steps, your config should look something like this:

```yaml
regex: \d{4}-\d{2}-\d{2}$ # regex to match date in title
format: YYYY-MM-DD # format of the above, for use with moment.js
gcal_calendar: id_goes_here # instructions in issue posted when app is added to repo
gcal_token: encrypted_token_here # same here
event_label: event # if you only want event issues with a certain label added to the calendar
```

## Developers

If you want to contribute or run your own instance of Campus Expert Calendar, this is the section for you. First up, you'll want to create a GitHub app with the following permissions:

* Issues: read & write
* Single file: read-only, path: `.github/calendar.yml`
* Events: Issues, Issue comment

Download the application's private key and save it to the same directory as this readme.

Copy `.env.example` to `.env` and set the `APP_ID`, `WEBHOOK_SECRET` and get the user ID of your app for `APP_USER_ID`. If you're using something like [smee.io](https://smee.io/) for development, set `WEBHOOK_PROXY_URL` to the appropriate URL.

Next up, create a Google API application and enable Google Calendar. In `.env`, set `GCAL_CLIENT_ID`, `GCAL_CLIENT_SECRET` and `GCAL_REDIRECT_URL`. Generate a long random string and use it as the value for `GCAL_TOKEN_SECRET`.

Finally, you should be able to install the required dependencies and launch the app:

```sh
npm install
npm start
```

More info on Probot deployment can be found in the [Probot docs](https://probot.github.io/docs/deployment/).
