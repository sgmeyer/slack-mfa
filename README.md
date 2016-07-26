# Slack Multi-Factor Authentication

This is a rule and webtask that adds multi-factor authentication to your [Auth0 account](https://www.Auth0.com) utilizing [Slack's](https://www.slack.com) direct messaging capabilities.

## Setup

1. Install the `wt-cli` tool and set it up for your [Auth0 account](https://manage.auth0.com/#/account/webtasks).
2. Generate an [Auth0 API token](https://auth0.com/docs/api/management/v2/tokens) with the scope `update:users`.
3. Use an existing or create a new [_custom bot user_](https://my.slack.com/services/new/bot).  Once you have a Slack bot you will need the API token for creating the webtask.
4. Setup a mongodb instance with a collection called _UsedToken_.  Create a [TTL index field](https://docs.mongodb.com/manual/tutorial/expire-data/#expire-documents-after-a-specified-number-of-seconds) watching `{ "date-blacklisted" : 1}` with a time to live for `300` seconds.
5. Deploy the slack-mfa.js to create your webtask:
```
wt create slack-mfa.js \
   -name slack-mfa \
   -s auth0_domain=yourdomain.auth0.com \
   -s auth0_api_token=your_auth0_api_token \
   -s mongo_connection='you_db_connection_string' \
   -s slack_api_token=your_slack_api_token \
   -s client_secret=your_client_secret \   
   --no-parse --no-merge
```
```
Parameters:
auth0_domain: Your auth0 subdomain(*domain*.auth0.com).
auth0-api-token: The token you generated with a scope of update:users from step 2.
mongo_connection: The connection string to you mongodb instance used for blacklisting tokens
slack_api_token: The token you generated from step 3.
client_secret: The secret you want to use to sign the tokens used between the rule and the webtask.
```
6. Create a new rule in your Auth0 account, copy the code from rule.js and replace the client_id of the application where you want to use Slack MFA.
>Go to the Rules section in the [Auth0 Dashboard](https://manage.auth0.com/#/rules). Click on *New Rule* and select *Empty rule*. Set the name of the rule and copy the code there.
7. Set up the rules parameters in the Rules Setting section (under the rules list)
```
mongo_connection: The mongodb connection string.
slack_mfa_url: The url of the webtask.
slack_mfa_secret: The secret you want to use to sign the tokens used between the rule and the webtask (it should be the same as the client_secret configured in the webtask).
```

## How It Works

Each time a user logs into your application the rule (rule.js) will execute and redirect the user to the slack-mfa webtask (mfa-slack.js).  The webtask will check to see if the user has enrolled in the Slack MFA.  If the user has completed their enrollment the webtaks will send a direct message to the user's confirmed Slack username.  The user must then click the link provided in the Slack direct message to complete the MFA.

Alternatively, when a user logs into your application and has not enrolled with Slack MFA the user will be taken through the enrollment process.  The enrollment process requires each user to provide their Slack username.  Once a username has been entered a direct message will be sent to that username.  If the user clicks on the link in the direct message their enrollment will be finalized.  In the event a user enters the wrong username or abandons the enrollment process the user will be asked for their Slack username upon each login until they finalize enrollment.

The enrollment process adds data to each user's 'user.user_metadata'.  This is the data the webtask reads and writes:

```js
{
  user_metadata: {
    "slack_mfa_username": "user's Slack username (san @ sign)",
    "slack_mfa_enrolled": true|false
  }
}
```

The `slack_mfa_username` is the Slack username collected upon enrollment and where the direct messages will be sent.  The `slack_mfa_enrolled` indicates if the user has completed registration.  If `slack-mfa-enrolled` is false or does not exist the user is considered partially enrolled, meaning each time the user attempts to log in the user will have to verify his or her username before a direct message will be sent.
