const request = require("request");


const sessions = {};
const categoryDict = {
	"General Knowledge": [9],
	"Entertainment": [10, 11, 12, 13, 14, 15, 16, 26, 29, 31, 32], 
	"Science": [17, 18, 19, 27, 30], 
	"Geography": [22],
	"History and Mythology": [20, 23, 24],
	"Sports": [21], 
	"Art": [25],
};


const getSession = (alexaid) => {
	if(!(alexaid in sessions)){
		sessions[alexaid] = {
				gameState: 0,
				diff: [],
				category: [],
				stats: {
					all: {
						total: 0,
						correct: 0
					}
				},
				multiple: false,
				prev: "What difficulty would you like to play at? The difficulty options are all, low, medium, hard, very hard, and extreme.",
				userId: "",
				tdbtoken: "",
				answer: "",
				multAns: "",
				choices: []
			};
	}
	return alexaid;
};

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
	console.log("recieved event");
	try {
		console.log("event.session.application.applicationId=" + event.session.application.applicationId);

		/**
		 * Uncomment this if statement and populate with your skill's application ID to
		 * prevent someone else from configuring a skill that sends requests to this function.
		 */

	// if (event.session.application.applicationId !== "") {
	//     context.fail("Invalid Application ID");
	//  }

		if (event.session.new) {
			onSessionStarted({requestId: event.request.requestId}, event.session);
		}

		if (event.request.type === "LaunchRequest") {
			onLaunch(event.request,
				event.session,
				function callback(sessionAttributes, speechletResponse) {
					context.succeed(buildResponse(sessionAttributes, speechletResponse));
				});
		} else if (event.request.type === "IntentRequest") {
			onIntent(event.request,
				event.session,
				function callback(sessionAttributes, speechletResponse) {
					context.succeed(buildResponse(sessionAttributes, speechletResponse));
				});
		} else if (event.request.type === "SessionEndedRequest") {
			onSessionEnded(event.request, event.session);
			context.succeed();
		}
	} catch (e) {
		context.fail("Exception: " + e);
	}
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
	// add any session init logic here
}

/**
 * Called when the user invokes the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
	getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {

	var intent = intentRequest.intent;
	var intentName = intentRequest.intent.name;

	// dispatch custom intents to handlers here
	if(intentName == "AMAZON.YesIntent"){
		handleYes(intent, session, callback);
	}
	else if(intentName == "AMAZON.NoIntent"){
		handleNo(intent, session, callback);
	}
	else if(intentName == "AMAZON.HelpIntent"){
		handleHelp(intent, session, callback);
	}
	else if(intentName == "AMAZON.RepeatIntent"){
		handleRepeat(intent, session, callback);
	}
	else if(intentName == "AMAZON.StopIntent"){
		handleStop(intent, session, callback);
	}
	else if(intentName == "sendRequest"){
		handleRequest(intent, session, callback);
	}
	else{
		throw "Invalid intent";
	}
}

// helper function to get information from apis (open trivia database)
function getJSON(url, callback){
	request.get(url, function(error, response, body){
		if(typeof body !== 'undefined'){
			var data = JSON.parse(body);
			callback(data);
		}
		else{
			console.log("Body recieved: " + body);
		}
	});
}


/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {

}

// ------- Skill specific logic -------

function getWelcomeResponse(callback) {
	var speechOutput = "Welcome to trivia! What difficulty would you like to play at? You can say all to get questions of varying diffuclty.\n" 
						+ "The other difficulty options are low, medium, hard, very hard, and extreme.";
	var reprompt = "What difficulty would you like to play at? The difficulty options are all, low, medium, hard, very hard, and extreme.";
	var header = "Trivia";
	var shouldEndSession = false;
	var sessionAttributes = {};
	callback(sessionAttributes, buildSpeechletResponse(header, speechOutput, reprompt, shouldEndSession));
}

function handleRequest(intent, session, callback){
	var id = getSession(session.sessionId);
	var header = "Trivia";
	var endSession = false;
	var speechOutput = "";
	var reprompt = "";
	// user input
	var cmd = intent.slots.command.value.toLowerCase();
	if(cmd.indexOf("repeat") >= 0){
		speechOutput = "Sure. " + sessions[id].prev;
		reprompt = sessions[id].prev;
		callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
	}
	else if(cmd.indexOf("help") >= 0){
		speechOutput = "You can ask to stop at any time to quit the game. "
			+ "If you would like to repeat the previous prompt, just ask Alexa to repeat the question. " 
			+ "If you are trying to change a setting, keep in mind you can only change settings after a question has been answered. "
			+ "The difficulty options are all, low, medium, hard, very hard, and extreme. "
			+ "The categories you can select from are everything, general knowledge, entertainment, science, geography, history and mythology, sports, and art.";
		reprompt = sessions[id].prev;
		callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
	}
	else if(cmd.indexOf("stop") >= 0){
		endSession = true;
		speechOutput = "Thank you for playing!";
		reprompt = "";
		delete(sessions[id]);
		callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
	}
	// question answer
	else if(sessions[id].gameState == 5){
		sessions[id].gameState = 6;
		// multiple choice question
		if(sessions[id].multiple){
			// add spaces to begining in end
			var withSpace = " " + cmd + " ";
			var correct = false;
			var incorrect = false;
			// check for correct letter surrounded by spaces
			for(var i = 0; i < sessions[id].choices.length + 1; i++){
				// if correct answer in cmd
				if(i == sessions[id].multAns && withSpace.indexOf(" " + String.fromCharCode(97 + i) + " ") >= 0){
					correct = true;
				}
				// if after correct answer in cmd
				if(i >= sessions[id].multAns){
					if(withSpace.indexOf(" " + String.fromCharCode(97 + i + 1) + " ") >= 0){
						console.log("incorrect loc:" + sessions[id].multAns + "i/i+1" + i + "/" + (i + 1) + " " + withSpace.indexOf(" " + String.fromCharCode(97 + i + 1) + " "));
						incorrect = true;
					}
				}
				// if before correct answer in cmd
				else if(withSpace.indexOf(" " + String.fromCharCode(97 + i) + " ") >= 0){
					console.log("incorrect loc:" + sessions[id].multAns + " i: " + i + " " + withSpace.indexOf(" " + String.fromCharCode(97 + i) + " "));
					incorrect = true;
				}
			}
			if(correct && incorrect){
				speechOutput += "Sorry, I can't count that as correct because you included both a correct and incorrect answer. ";
			}
			else if(correct){
				speechOutput += "That is correct! ";
			}
			else if(incorrect){
				speechOutput += "Sorry, that's not the answer. ";
			}
			else{
				sessions[id].gameState = 5;
				speechOutput += "You did not indicate your answer using a, b, c, or d. ";
				speechOutput += sessions[id].prev;
			}
		}
		else{
			// remove punctuation
			var removePunct = sessions[id].answer.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ");
			removePunct = removePunct.replace(/\s{2,}/g, " ");
			var corWords = removePunct.toLowerCase().split(" ");
			console.log(corWords.join());
			for(var i in corWords){
				// if correct word found
				if(cmd.indexOf(corWords[i]) >= 0){
					speechOutput += "That is correct! ";
					break;
				}
			}
			if(speechOutput != "That is correct! "){
				speechOutput += "Sorry, that's not the answer. ";
			}
		}
		// if a valid answer was given
		if(sessions[id].gameState != 5){
			speechOutput += "The answer was \"";
			if(sessions[id].multiple){
				speechOutput += String.fromCharCode(97 + sessions[id].multAns) + ") ";
			}
			speechOutput += sessions[id].answer + "\". Are you ready for the next question?";
			reprompt = "Are you ready for the next question?";
			sessions[id].prev = speechOutput;
		}
		callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
	}
	// select difficulty
	else if(sessions[id].gameState == 0){
		var valid = true;
		if(cmd.indexOf("all") >= 0){
			sessions[id].diff = ["easy", "medium", "hard"];
			speechOutput += "All difficulties ";
		}
		else if(cmd.indexOf("low") >= 0 || cmd.indexOf("easy") >= 0){
			sessions[id].diff = ["easy"];
			speechOutput += "Low difficulty ";
		}
		else if(cmd.indexOf("medium") >= 0 || cmd.indexOf("average") >= 0){
			sessions[id].diff = ["easy", "medium"];
			speechOutput += "Medium difficulty ";
		}
		else if(cmd.indexOf("very hard") >= 0){
			sessions[id].diff = ["medium", "hard"];
			speechOutput += "Very hard difficulty ";
		}
		else if(cmd.indexOf("hard") >= 0 || cmd.indexOf("high") >= 0){
			sessions[id].diff = ["medium"];
			speechOutput += "Hard difficulty ";
		}
		else if(cmd.indexOf("extreme") >= 0){
			sessions[id].diff = ["hard"];
			speechOutput += "Extreme difficulty ";
		}
		else if(cmd.indexOf("difficult") >= 0 || cmd.indexOf("mode") >= 0){
			valid = false;
			speechOutput = "Sorry, that difficulty is not available. The difficulty options are all, low, medium, hard, very hard, and extreme.";
			callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
		}
		else{
			valid = false;
			if(cmd.indexOf("everything") >= 0 ||
				cmd.indexOf("general knowledge") >= 0 ||
				cmd.indexOf("entertainment") >= 0 ||
				cmd.indexOf("science") >= 0 ||
				cmd.indexOf("geography") >= 0 ||
				cmd.indexOf("history") >= 0 || cmd.indexOf("mythology") >= 0 ||
				cmd.indexOf("sports") >= 0 ||
				cmd.indexOf("art") >= 0||
				cmd.indexOf("category") >= 0){
				speechOutput = "Sorry, you can't change the category now. You can change game settings after a question has been answered.";
				reprompt = sessions[id].prev;
			}
			else{
				speechOutput = "I'm sorry, I couldn't understand what you said.";
				reprompt = sessions[id].prev;
			}
			callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
		}
		if(valid){
			sessions[id].gameState = 1;
			speechOutput += "selected. Would you like to play a specific category? Answer no to play questions from all categories.";
			reprompt = "You can also answer yes to only get Trivia questions from one of the following categories: everything, general knowledge, entertainment, science, geography, history and mythology, sports, and art.";
			sessions[id].prev = "Would you like to play a specific category? Answer no to play questions from all categories.";
			callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
		}
	}
	// select category
	else if(sessions[id].gameState == 2){
		valid = true;
		if(cmd.indexOf("everything") >= 0){
			sessions[id].category = [];
			speechOutput += "All categories ";
		}
		else if(cmd.indexOf("general knowledge") >= 0){
			sessions[id].category = categoryDict["General Knowledge"];
			speechOutput += "General knowledge ";
		}
		else if(cmd.indexOf("entertainment") >= 0){
			sessions[id].category = categoryDict["Entertainment"];
			speechOutput += "Entertainment ";
		}
		else if(cmd.indexOf("science") >= 0){
			sessions[id].category = categoryDict["Science"];
			speechOutput += "Science ";
		}
		else if(cmd.indexOf("geography") >= 0){
			sessions[id].category = categoryDict["Geography"];
			speechOutput += "Geography ";
		}
		else if(cmd.indexOf("history") >= 0 || cmd.indexOf("mythology") >= 0){
			sessions[id].category = categoryDict["History and Mythology"];
			speechOutput += "History and Mythology ";
		}
		else if(cmd.indexOf("sports") >= 0){
			sessions[id].category = categoryDict["Sports"];
			speechOutput += "Sports ";
		}
		else if(cmd.indexOf("art") >= 0){
			sessions[id].category = categoryDict["Art"];
			speechOutput += "Art ";
		}
		else if(cmd.indexOf("categor") >= 0){
			valid = false;
			speechOutput += "I'm sorry, that is not an available category. Choose between the following choices: everything, general knowledge, entertainment, science, geography, history and mythology, sports, and art.";
			callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
		}
		else{
			valid = false;
			if(cmd.indexOf("all") >= 0 || 
				cmd.indexOf("low") >= 0 || cmd.indexOf("easy") >= 0 ||
				cmd.indexOf("medium") >= 0 || cmd.indexOf("average") >= 0 ||
				cmd.indexOf("very hard") >= 0 ||
				cmd.indexOf("hard") >= 0 || cmd.indexOf("high") >= 0 ||
				cmd.indexOf("extreme") >= 0 ||
				cmd.indexOf("difficult") >= 0 || cmd.indexOf("mode") >= 0){
				speechOutput = "Sorry, you can't change the difficulty now. You can change game settings after a question has been answered.";
			}else{
				speechOutput = "I'm sorry, I couldn't understand what you said.";
				reprompt = sessions[id].prev;
			}
			callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
		}
		if(valid){
			sessions[id].gameState = 3;
			speechOutput += "selected. You can change the settings at any time after a question has been answered. Are you ready to play?";
			reprompt = "Are you ready to play?";
			sessions[id].prev = speechOutput;
			callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
		}
	}
	// change settings
	else if(sessions[id].gameState == 6 || sessions[id].gameState == 7){
		// difficulty change
		var validDiff = true;
		// category change
		var validCat = true;
		// difficulty check
		if(cmd.indexOf("all") >= 0){
			sessions[id].diff = ["easy", "medium", "hard"];
			speechOutput += "All difficulties ";
		}
		else if(cmd.indexOf("low") >= 0 || cmd.indexOf("easy") >= 0){
			sessions[id].diff = ["easy"];
			speechOutput += "Low difficulty ";
		}
		else if(cmd.indexOf("medium") >= 0 || cmd.indexOf("average") >= 0){
			sessions[id].diff = ["easy", "medium"];
			speechOutput += "Medium difficulty ";
		}
		else if(cmd.indexOf("very hard") >= 0){
			sessions[id].diff = ["medium", "hard"];
			speechOutput += "Very hard difficulty ";
		}
		else if(cmd.indexOf("hard") >= 0 || cmd.indexOf("high") >= 0){
			sessions[id].diff = ["medium"];
			speechOutput += "Hard difficulty ";
		}
		else if(cmd.indexOf("extreme") >= 0){
			sessions[id].diff = ["hard"];
			speechOutput += "Extreme difficulty ";
		}
		else if(cmd.indexOf("difficult") >= 0 || cmd.indexOf("mode") >= 0){
			validDiff = false;
			speechOutput = "Sorry, that difficulty is not available. The difficulty options are all, low, medium, hard, very hard, and extreme. ";
		}
		else{
			validDiff = false;
		}
		if(validDiff){
			speechOutput += "selected. ";
		}
		// category check
		if(cmd.indexOf("everything") >= 0){
			sessions[id].category = [];
			speechOutput += "All categories ";
		}
		else if(cmd.indexOf("general knowledge") >= 0){
			sessions[id].category = categoryDict["General Knowledge"];
			speechOutput += "General knowledge ";
		}
		else if(cmd.indexOf("entertainment") >= 0){
			sessions[id].category = categoryDict["Entertainment"];
			speechOutput += "Entertainment ";
		}
		else if(cmd.indexOf("science") >= 0){
			sessions[id].category = categoryDict["Science"];
			speechOutput += "Science ";
		}
		else if(cmd.indexOf("geography") >= 0){
			sessions[id].category = categoryDict["Geography"];
			speechOutput += "Geography ";
		}
		else if(cmd.indexOf("history") >= 0 || cmd.indexOf("mythology") >= 0){
			sessions[id].category = categoryDict["History and Mythology"];
			speechOutput += "History and Mythology ";
		}
		else if(cmd.indexOf("sports") >= 0){
			sessions[id].category = categoryDict["Sports"];
			speechOutput += "Sports ";
		}
		else if(cmd.indexOf("art") >= 0){
			sessions[id].category = categoryDict["Art"];
			speechOutput += "Art ";
		}
		else if(cmd.indexOf("categor") >= 0){
			validCat = false;
			speechOutput += "I'm sorry, that is not an available category. You can choose between the following choices: everything, general knowledge, entertainment, science, geography, history and mythology, sports, and art.";
		}
		else{
			validCat = false;
		}
		if(validCat){
			speechOutput += "selected. ";
		}
		if(speechOutput == ""){
			speechOutput = "I'm sorry, I couldn't understand what you said.";
			reprompt = sessions[id].prev;
			callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
		}
		else{
			speechOutput += "Are you ready to play?";
			reprompt = "Are you ready to play?";
			sessions[id].prev = speechOutput;
			callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
		}
	}
	else{
		if(cmd.indexOf("all") >= 0 || 
			cmd.indexOf("low") >= 0 || cmd.indexOf("easy") >= 0 ||
			cmd.indexOf("medium") >= 0 || cmd.indexOf("average") >= 0 ||
			cmd.indexOf("very hard") >= 0 ||
			cmd.indexOf("hard") >= 0 || cmd.indexOf("high") >= 0 ||
			cmd.indexOf("extreme") >= 0 ||
			cmd.indexOf("difficult") >= 0 || cmd.indexOf("mode") >= 0){
			speechOutput = "Sorry, you can't change the difficulty now. You can change game settings after a question has been answered.";
		}
		else if(cmd.indexOf("everything") >= 0 ||
			cmd.indexOf("general knowledge") >= 0 ||
			cmd.indexOf("entertainment") >= 0 ||
			cmd.indexOf("science") >= 0 ||
			cmd.indexOf("geography") >= 0 ||
			cmd.indexOf("history") >= 0 || cmd.indexOf("mythology") >= 0 ||
			cmd.indexOf("sports") >= 0 ||
			cmd.indexOf("art") >= 0||
			cmd.indexOf("categor") >= 0){
			speechOutput = "Sorry, you can't change the category now. You can change game settings after a question has been answered.";
		}
		else{
			speechOutput = "I'm sorry, I couldn't understand what you said.";
			reprompt = sessions[id].prev;
		}
		callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
	}
}

function handleYes(intent, session, callback){
	var id = getSession(session.sessionId);
	var header = "Trivia";
	var endSession = false;
	var speechOutput = "";
	var reprompt = "";
	// ready for question
	if(sessions[id].gameState == 1){
		sessions[id].gameState = 2;
		speechOutput = "What category would you like to play? You can play everything, general knowledge, entertainment, science, geography, history and mythology, sports, and art.";
		reprompt = "Choose between all, general knowledge, entertainment, science, geography, history and mythology, sports, and art.";
		sessions[id].prev = speechOutput;
		callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
	}
	else if(sessions[id].gameState == 3 || sessions[id].gameState == 6 || sessions[id].gameState == 7){
		// get database token
		if(sessions[id].tdbtoken == ""){
			getJSON("https://opentdb.com/api_token.php?command=request", function(data){
				sessions[id].tdbtoken = data.token;
			});
		}
		sessions[id].gameState = 5;
		//select diffuclty
		var diff = sessions[id].diff[Math.floor(Math.random() * sessions[id].diff.length)];
		// construct url
		var url = "https://opentdb.com/api.php?amount=1&encode=base64&difficulty=" + diff + "&token=" + sessions[id].tdbtoken;
		if(sessions[id].category.length > 0){
			var cat = sessions[id].category[Math.floor(Math.random() * sessions[id].category.length)];
			url += "&category=" + cat;
		}
		console.log(url);
		getJSON(url, function(data){
			console.log("Database says: " + JSON.stringify(data));
			var result = data.results[0];
			// decode category and question
			var category = decode(result.category);
			var question = decode(result.question);
			speechOutput = "Category: " + category + ". " + question + " ";
			sessions[id].multiple = false;
			// check question type
			if(decode(result.type) == "boolean"){
				// save correct answer
				speechOutput += " True or false?";
				sessions[id].answer = decode(result.correct_answer).toLowerCase();
				sessions[id].choices = [];
			}
			else{
				var answers = [];
				var newLine = false;
				var newLineLimit = 25;
				// decode incorrect answers
				for(var i in data.results[0].incorrect_answers){
					answers.push(decode(data.results[0].incorrect_answers[i]));
					newLine = newLine || answers[i].length > newLineLimit;
					sessions[id].hasNum = sessions[id].hasNum || hasNonAlpha(answers[i]);
				}
				// save incorrect answers and correct answer
				sessions[id].choices = answers.slice();
				sessions[id].answer = decode(result.correct_answer);
				sessions[id].multiple = sessions[id].multiple || hasNonAlpha(sessions[id].answer);
				newLine = newLine || sessions[id].answer.length > newLineLimit;
				// splice correct answer in randomly
				var loc = Math.floor(Math.random() * (answers.length + 1));
				answers.splice(loc, 0, sessions[id].answer);
				// remove punctuation
				var removePunct = sessions[id].answer.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ");
				removePunct = removePunct.replace(/\s{2,}/g, " ");
				var corWords = removePunct.split(" ");
				// check for words in the right answer also in wrong answers
				var isSplice = false;
				for(var i in corWords){
					corWords[i] = corWords[i].toLowerCase();
					for(var j in sessions[id].choices){
						if(sessions[id].choices[j].toLowerCase().indexOf(corWords[i]) >= 0){
							console.log("The word " + corWords[i] + " appears in the right answer: " + sessions[id].answer + " and in a wrong answer " + sessions[id].choices[j]);
							corWords.splice(i, 1);
							isSplice = true;
							break;
						}
					}
					if(isSplice){
						break;
					}
				}
				// if two words are similar then answer with a, b, c, d
				sessions[id].multiple = sessions[id].multiple || isSplice;
				if(sessions[id].multiple){
					sessions[id].multAns = loc;
					speechOutput += "Please indicate your answer using a, b, c, or d. ";
				}
				// add answer choices to speech output
				for(var i = 0; i < answers.length - 1; i++){
					if(sessions[id].multiple || newLine){
						speechOutput += "\n";
					}
					if(sessions[id].multiple){
						speechOutput += String.fromCharCode(97 + i) + ") ";
					}
					speechOutput += answers[i] + ", ";
				}
				if(sessions[id].multiple || newLine){
					speechOutput += "\n";
				}
				if(sessions[id].multiple){
					speechOutput += String.fromCharCode(97 + answers.length - 1) + ") " + answers[answers.length - 1];
				}
				else{
					speechOutput += "or " + answers[answers.length - 1] + "?";
				}
				
			}
			// replace any '&' characters
			speechOutput = speechOutput.replace("&", "and");
			// save question
			sessions[id].prev = speechOutput;
			reprompt = speechOutput;
			callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
		});
	}
	else{
		speechOutput += "I'm sorry, I'm not sure what you are asking.";
		reprompt = sessions[id].prev;
		callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
	}
}

function handleNo(intent, session, callback){
	var id = getSession(session.sessionId);
	var header = "Trivia";
	var endSession = false;
	var speechOutput = "";
	var reprompt = "";
	if(sessions[id].gameState == 1){
		sessions[id].gameState = 3;
		speechOutput = "Alright, you can change the settings at any time after a question has been answered. Are you ready to play?";
		reprompt = "Say yes when you are ready to play.";
		sessions[id].prev = speechOutput;
	}
	else if(sessions[id].gameState == 3 || sessions[id].gameState == 4){
		sessions[id].gameState == 4;
		speechOutput = "Ok, say yes when you are ready to play.";
		reprompt = "Say yes when you are ready to play.";
		sessions[id].prev = reprompt;
	}
	else if(sessions[id].gameState == 6){
		sessions[id].gameState = 7;
		speechOutput = "Okay, answer yes when you are ready to play. You can also change the settings or stop playing.";
		reprompt = "Answer yes when you are ready to play or say stop to stop playing.";
		sessions[id].prev = speechOutput;
	}
	else{
		speechOutput += "I'm sorry, I'm not sure what you are asking.";
		reprompt = sessions[id].prev;
	}
	callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
}

function handleHelp(intent, session, callback){
	var id = getSession(session.sessionId);
	var header = "Trivia";
	var endSession = false;
	var speechOutput = "You can ask to stop at any time to quit the game. "
		+ "If you would like to repeat the previous prompt, just ask Alexa to repeat the question. " 
		+ "If you are trying to change a setting, keep in mind you can only change settings after a question has been answered. "
		+ "The difficulty options are all, low, medium, hard, very hard, and extreme. "
		+ "The categories you can select from are everything, general knowledge, entertainment, science, geography, history and mythology, sports, and art.";
	var reprompt = sessions[id].prev;
	callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
}

function handleRepeat(intent, session, callback){
	var id = getSession(session.sessionId);
	var header = "Trivia";
	var endSession = false;
	var speechOutput = "Sure. " + sessions[id].prev;
	var reprompt = sessions[id].prev;
	callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
}

function handleStop(intent, session, callback){
	var id = getSession(session.sessionId);
	var header = "Trivia";
	var endSession = true;
	var speechOutput = "Thank you for playing!";
	var reprompt = "";
	delete(sessions[id]); 
	callback(session.attributes, buildSpeechletResponse(header, speechOutput, reprompt, endSession));
}

function decode(base64){
	return (new Buffer(base64, 'base64')).toString('utf8');
}

function hasNonAlpha(str) {
	return /[^a-z\s]/i.test(str);
}

function handleFinishSessionRequest(intent, session, callback) {
	// End the session with a "Good bye!" if the user wants to quit the game
	callback(session.attributes,
		buildSpeechletResponseWithoutCard("Good bye!", "", true));
}

// ------- Helper functions to build responses for Alexa -------
function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
	return {
		outputSpeech: {
			type: "PlainText",
			text: output
		},
		card: {
			type: "Simple",
			title: title,
			content: output
		},
		reprompt: {
			outputSpeech: {
				type: "PlainText",
				text: repromptText
			}
		},
		shouldEndSession: shouldEndSession
	};
}

function buildSpeechletResponseWithoutCard(output, repromptText, shouldEndSession) {
	return {
		outputSpeech: {
			type: "PlainText",
			text: output
		},
		reprompt: {
			outputSpeech: {
				type: "PlainText",
				text: repromptText
			}
		},
		shouldEndSession: shouldEndSession
	};
}

function buildResponse(sessionAttributes, speechletResponse) {
	return {
		version: "1.0",
		sessionAttributes: sessionAttributes,
		response: speechletResponse
	};
}