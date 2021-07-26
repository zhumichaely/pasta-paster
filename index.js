/* Michael Zhu 
   Updated transcription bot for r/copypasta
   
   V3 UPDATE: Reddit has imposed a new COMMENT rate limit.
   The request rate limit remains the same,
   but bots can now only post every 10 minutes or so.
   The addition of the post queue attempts to salvage this */

const snoowrap = require("snoowrap");
const { SubmissionStream } = require("snoostorm");
const keys = require("./auth.js");
const superagent = require("superagent");
const replyWords = require("./replies.js").words;

const BOT = new snoowrap(keys.credentials);
const BOT_START = Date.now() / 1000;
const TITLE_MAX = 64;
const POST_QUEUE = [];

/* chooses 4-8 random words from the list given by mods.
   Entire comment will be hyperlinked to pastebin */
function randomReply(words, link) {
    let reply = "[";
    const quantity = 3 + Math.random() * 5;
    for (let i = 0; i < quantity; i++) {
        const index = Math.random() * words.length;
        reply += words[Math.floor(index)] + " ";
    }
    return reply.substring(0, reply.length - 1) + `](${link})`;
}

/* paste.ee suggests a rate limit of 10 requests/min.
   Reddit's request limit is 60 requests/min.
   This choice of request frequency balances the rate limits,
   keeps requests low(er), and *shouldn't* miss a new post */
const posts = new SubmissionStream(BOT, {
    subreddit: "copypasta",
    limit: 2,
    pollTime: 10000
});

posts.on("item", post => {
    if (post.created_utc < BOT_START) return;
    
    /* paste.ee limits titles to 64 characters.
       Reddit limits titles to 300 characters.
       Titles that are too long will be truncated */
    let title = post.title;
    if (post.title.length > TITLE_MAX) {
        title = title.substring(0, TITLE_MAX - 3) + "...";
    }

    /* Reddit allows self posts with no text body.
       paste.ee requires a text body, but also
       conveniently happens to accept a zero-width space */
    const content = {
        expiration: "never",
        sections: [{
            name: title,
            contents: post.selftext ? post.selftext : "\u200b",
        }]
    };

    superagent.post("https://api.paste.ee/v1/pastes")
    .set("Content-Type", "application/json")
    .set("X-Auth-Token", keys.auth)
    .send(JSON.stringify(content))
    .then(response => {
        POST_QUEUE.push({
            post: post,
            reply: randomReply(replyWords, response.body.link)
        });
    })
    /* the paste.ee API has not failed a single time.
       The new rate limit from Reddit is handled separately */
    .catch(err => console.log(err));
});

/* attempt to comment the head of the post queue */
function tryComment() {
    if (POST_QUEUE.length === 0) return;

    const comment = POST_QUEUE[0];
    try {
        comment.post.reply(comment.reply);
        POST_QUEUE.shift();
    }
    catch (err) {
        console.log(err);
    }
}

/* Trying often will avoid situations where the interval
   is off by a little and the bot has to wait a lot
   before it tries again when it doesn't have to. */
setInterval(tryComment, 10000);
