// Settings for the live read of the Google Sheet. The OAuth client ID only identifies
// this app to Google; it is not a secret. Reading still needs the signed-in person to
// have access to the sheet. The sheet ID is never stored in this repo: the owner shares
// a link that carries it (?sheet=...), and it is then kept in this browser session only.
export const CONFIG = {
  clientId: '708358954866-8vauri7omd6ed9il9ebekogcp5gn4qf7.apps.googleusercontent.com',
  tab: 'Main',
  configTab: 'Dashboard_Config',
  domain: 'nathabit.in', // only Google accounts on this domain may sign in
};
