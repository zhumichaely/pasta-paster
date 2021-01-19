/* Michael Zhu 
   u/cumifier implementation for r/copypasta */

const snoowrap = require("snoowrap");
const { SubmissionStream } = require("snoostorm");
const keys = require("./auth.js");
const superagent = require("superagent");

const BOT = new snoowrap(keys.credentials);
const BOT_START = Date.now() / 1000;
const TITLE_MAX = 64;

/* paste.ee suggests a rate limit of 120 requests/10 min.
   In practice, the API allocates 10 requests/min,
   but that limit isn't enforced at all for some reason.
   Reddit's request limit is 60 requests/min.
   This choice of request frequency balances the rate limits,
   keeps requests low(er), and *shouldn't* miss a new post */
const posts = new SubmissionStream(BOT, {
    subreddit: "copypasta",
    limit: 2,
    pollTime: 10000
});

console.log("listening");
posts.on("item", post => {
    if (post.created_utc < BOT_START) return;
    
    /* paste.ee limits titles to 64 characters.
       Reddit limits titles to 300 characters.
       Titles that are too long will be truncated */
    let title = post.title;
    if (post.title.length > TITLE_MAX) {
        title = title.substring(0, TITLE_MAX - 3) + "...";
    }

    /* pastes will stay up as long as paste.ee does.
       consider donating to its author:
       https://www.patreon.com/ccatss */
    const content = {
        expiration: "never",
        sections: [{
            name: title,
            contents: post.selftext,
        }]
    };

    superagent.post("https://api.paste.ee/v1/pastes")
    .set("Content-Type", "application/json")
    .set("X-Auth-Token", keys.auth)
    .send(JSON.stringify(content))
    /* bot will comment the link under every post */
    .then(response => {
        post.reply(`Copy this pasta [here](${response.body.link}).`);
    })
    /* no error handling. I am still just a student,
       and frankly I have no idea what to do here */
    .catch(err => console.log(err));
});
