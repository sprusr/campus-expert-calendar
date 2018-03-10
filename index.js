var moment = require('moment')

module.exports = (robot) => {
  robot.log('Yay, the app was loaded!')

  const defaultConfig = {
    regex: '(\d{4})-(\d{2})-(\d{2})$',
    format: 'YYYY-MM-DD'
  }

  robot.on('issues.opened', async context => {
    const config = await context.config('calendar.yml', defaultConfig)

    const issueId = context.payload.issue.id
    const issueTitle = context.payload.issue.title

    const dateMatches = issueTitle.match(config.regex)
    if (dateMatches.length == 0) return false

    const issueDate = moment(dateMatches[0], config.format)

    robot.log(issueDate)

    // do gcal stuff
  })

  robot.on('issues.edited', context => {
    const issueId = context.payload.issue.id
    const issueTitle = context.payload.issue.title
  })
}
