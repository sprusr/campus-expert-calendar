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

    const commentsResponse = await context.github.issues.getComments(context.issue())
    const comments = commentsResponse.data
    for (let comment of comments) {
      if (comment.body.startsWith('🌟') && comment.user.id === APP_USER_ID) {
        return false
      }
    }

    const oauth2Client = new OAuth2Client(GCAL_CLIENT_ID, GCAL_CLIENT_SECRET, GCAL_REDIRECT_URL)

    // get the tokens and encrypt
    const tokensResponse = await oauth2Client.getToken(context.payload.comment.body)
    const tokens = tokensResponse.tokens
    robot.log(tokens)
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

    const oauth2Client = new OAuth2Client(GCAL_CLIENT_ID, GCAL_CLIENT_SECRET, GCAL_REDIRECT_URL)
    const bytes = AES.decrypt(config.gcal_token, GCAL_TOKEN_SECRET)
    const credentials = JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
    robot.log(credentials)
    oauth2Client.setCredentials(credentials)

    const issueTitle = context.payload.issue.title
    const issueBody = context.payload.issue.body
    const issueUrl = context.payload.issue.html_url

    const dateMatches = issueTitle.match(config.regex)
    if (!dateMatches || dateMatches.length === 0) {
      // TODO: post a comment on issue asking for correct format if event label is set
      robot.log.info(`No matches for date regex on issue: ${issueTitle}`)
      return false
    }

    const issueDate = moment(dateMatches[0], config.format)
    if (!issueDate.isValid()) {
      robot.log.warn('Unable to parse date.')
      return false
    }

    const calendar = google.calendar('v3')

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

    await calendar.events.insert({
      auth: oauth2Client,
      calendarId: config.gcal_calendar,
      resource: event
    })

    robot.log.info('Event added to calendar!')
  })

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
