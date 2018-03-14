const moment = require('moment')
const { google } = require('googleapis')
const { OAuth2Client } = require('google-auth-library')
const CryptoJS = require('crypto-js')
const AES = CryptoJS.AES

const DEFAULT_CONFIG = {
  regex: '(\\d{4})-(\\d{2})-(\\d{2})$',
  format: 'YYYY-MM-DD'
}
const GCAL_SCOPES = ['https://www.googleapis.com/auth/calendar']

const APP_USER_ID = process.env.APP_USER_ID
const GCAL_CLIENT_ID = process.env.GCAL_CLIENT_ID
const GCAL_CLIENT_SECRET = process.env.GCAL_CLIENT_SECRET
const GCAL_REDIRECT_URL = process.env.GCAL_REDIRECT_URL
const GCAL_TOKEN_SECRET = process.env.GCAL_TOKEN_SECRET

module.exports = (robot) => {
  // on install, post instructions issue
  robot.on('installation.created', async context => {
    const oauth2Client = new OAuth2Client(GCAL_CLIENT_ID, GCAL_CLIENT_SECRET, GCAL_REDIRECT_URL)
    const authUrl = generateAuthUrl(oauth2Client)

    for (let repo of context.payload.repositories) {
      console.log(repo)
      context.github.issues.create({
        owner: repo.full_name.split('/')[0],
        repo: repo.name,
        title: '[Campus Expert Calendar] Configuration Needed',
        body: `🎉 Thank you for installing Campus Expert Calendar! Before it will work, you'll need to do a bit of setup...\n\nPlease visit [this page](${authUrl}), accept the permissions, then comment on this issue with the code it generates.`,
        assignee: context.payload.sender.login
      })
    }
  })

  // on issue comment, get tokens
  robot.on('issue_comment.created', async context => {
    if (context.payload.issue.title !== '[Campus Expert Calendar] Configuration Needed') return false
    if (context.payload.issue.user.id !== APP_USER_ID) return false

    // if we already gave a code, don't do it again
    const commentsResponse = await context.github.issues.getComments(context.issue())
    const comments = commentsResponse.data
    for (let comment of comments) {
      if (comment.body.startsWith('🌟') && comment.user.id === APP_USER_ID) {
        return false
      }
    }

    // get the tokens and encrypt
    const oauth2Client = new OAuth2Client(GCAL_CLIENT_ID, GCAL_CLIENT_SECRET, GCAL_REDIRECT_URL)
    const tokensResponse = await oauth2Client.getToken(context.payload.comment.body)
    const tokens = tokensResponse.tokens
    const tokensString = JSON.stringify(tokens)
    const encryptedTokens = AES.encrypt(tokensString, GCAL_TOKEN_SECRET).toString()

    // post on issue
    context.github.issues.createComment(context.issue({body: `🌟 Thanks for that! Use this code as \`gcal_token\` in \`.github/calendar.yml\`:\n\`\`\`\n${encryptedTokens}\n\`\`\`\nYou'll also need to get the ID of the calendar to add events to. You can get a list of calendars with IDs on [this page](https://developers.google.com/calendar/v3/reference/calendarList/list).\n\nThen you should be ready to go. Feel free to close this issue and delete the contents of the comments.`}))
  })

  robot.on('issues.opened', async context => {
    const config = await context.config('calendar.yml', DEFAULT_CONFIG)

    if (!config.gcal_token) {
      robot.log.error('No gcal token set.')
      return false
    }

    if (!config.gcal_calendar) {
      robot.log.error('No calendar set.')
      return false
    }

    // if event issues should have labels, check if this one does
    if (config.event_label) {
      let labeled = false
      for (let label of context.payload.issue.labels) {
        if (label.name === config.event_label) labeled = true
      }
      if (!labeled) return false
    }

    // issue info in nice handy variables
    const issueTitle = context.payload.issue.title
    const issueBody = context.payload.issue.body
    const issueUrl = context.payload.issue.html_url

    // does issue title match with our regex
    const dateMatches = issueTitle.match(config.regex)
    if (!dateMatches || dateMatches.length === 0) {
      // TODO: post a comment on issue asking for correct format if event label is set
      robot.log.info(`No matches for date regex on issue: ${issueTitle}`)
      return false
    }

    // does matched date string parse correctly
    const issueDate = moment(dateMatches[0], config.format)
    if (!issueDate.isValid()) {
      robot.log.warn('Unable to parse date.')
      return false
    }

    // set up our gcal api client
    const oauth2Client = getOAuth2Client(config.gcal_token)
    const calendar = google.calendar('v3')

    // create the event json and insert an event
    const event = {
      summary: issueTitle.replace(new RegExp(config.regex), ''),
      description: `${issueUrl}\n\n${issueBody}`,
      start: {
        date: issueDate.format('YYYY-MM-DD')
      },
      end: {
        date: issueDate.format('YYYY-MM-DD')
      }
    }
    calendar.events.insert({
      auth: oauth2Client,
      calendarId: config.gcal_calendar,
      resource: event
    }, (err, res) => {
      robot.log.info('Event added to calendar!')
    })
  })

  // on label add, if we require event label, add event to calendar
  robot.on('issues.labeled', async context => {
    const config = await context.config('calendar.yml', DEFAULT_CONFIG)

    if (!config.event_label || context.payload.label.name !== config.event_label) {
      return false
    }

    // issue info in nice handy variables
    const issueTitle = context.payload.issue.title
    const issueUrl = context.payload.issue.html_url

    // does issue title match with our regex
    const dateMatches = issueTitle.match(config.regex)
    if (!dateMatches || dateMatches.length === 0) {
      // TODO: post a comment on issue asking for correct format if event label is set
      robot.log.info(`No matches for date regex on issue: ${issueTitle}`)
      return false
    }

    // does matched date string parse correctly
    const issueDate = moment(dateMatches[0], config.format)
    if (!issueDate.isValid()) {
      robot.log.warn('Unable to parse date.')
      return false
    }

    // set up our gcal api client
    const oauth2Client = getOAuth2Client(config.gcal_token)

    // get events and check if this issue is in there
    const events = await getCalendarEvents({
      auth: oauth2Client,
      calendarId: config.gcal_calendar,
      timeMin: issueDate.startOf('day').toDate(),
      timeMax: issueDate.endOf('day').toDate()
    })

    // if the event is already in calendar, don't add it again
    for (let event of events) {
      if (event.description.startsWith(issueUrl)) {
        return false
      }
    }

    // TODO add event
  })

  // on label add, if we require event label, add event to calendar
  robot.on('issues.unlabeled', context => {
    if (!config.event_label) {
      return false
    }

    console.log(context.payload)

    // TODO
    // if event not already in calendar
    // and label added was event label
    // add to calendar
  })

  // if already in calendar, update, otherwise if now applicable, add to calendar
  robot.on('issues.edited', context => {
    // const issueId = context.payload.issue.id
    // const issueTitle = context.payload.issue.title

    // TODO: change date of event on edit
  })
}

const generateAuthUrl = (oauth2Client) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GCAL_SCOPES
  })
  return authUrl
}

const getOAuth2Client = (token) => {
  const oauth2Client = new OAuth2Client(GCAL_CLIENT_ID, GCAL_CLIENT_SECRET, GCAL_REDIRECT_URL)
  const bytes = AES.decrypt(token, GCAL_TOKEN_SECRET)
  const credentials = JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
  oauth2Client.setCredentials(credentials)
  return oauth2Client
}

const getCalendarEvents = (params) => {
  return new Promise(async (resolve, reject) => {
    const calendar = google.calendar('v3')
    const events = await calendar.events.list(params, (err, res) => {
      if (err) return reject(err)
      return resolve(res.data)
    })
  })
}
