// Monster Management Script
// Usage: !monster import // This will read the "Monster Import" handout, and import it in to roll20.
//   See monster-import.txt for example formatting. The regular expressions that power this system should
//   be capable of parsing most monster entries from the SRD, as well as the Monster Manual(s).
//   Let me know if you find a monster that fails to parse properly!
// !monster generate (MonsterName) // Select 1 or more monsters, then run this command. All selected tokens
//   will be linked to the applicable monster's sheet, and have their health bar (bar1) populated with a randomly
//   rolled min/max hitpoint value, derived from the monster's HD. Bar2 will be filled with notes relevant to the monster
//   (If using my TokeNotes script), and bar3 will be populated with the monster's AC.
// !monster clear-all // Removes all automatically generated monsters.

var MonsterManager = MonsterManager || {};
var importName = "Monster Import";
MonsterManager.safetyKey = "_autoGeneratedMonster";
MonsterManager.safetyValue = "safeToDeleteAutomatically";
MonsterManager.defaultAvatar = "http://t2.gstatic.com/images?q=tbn:ANd9GcT4b4rwJZHqzTtmn0EPjkeOe2JbmeRiJOsqUB7LpPUu-00bMiW7KQOb4A";
MonsterManager.mandatoryFields = ["name", "hitdie", "ac", "attack", "full_attack"];

MonsterManager.ShowUsage = function(msg) {
    sendChat("API", "/w " + msg.who + " You must specify an argument for this command. Usage: (Enter this).");
};

MonsterManager.BadLine = function(monsterName, line) {
    MonsterManager.LogAndNotify("Hit malformatted entry while processing " + monsterName + ": '" + line+"'");
};

MonsterManager.Import = function(cmd, args, handout) {
    var partialMatches = ["touch", "fortitude", "reflex", "will", "str-base", "dex-base", "con-base", "int-base", "wis-base", /*"cha", */ ];
    var regexMap = {
        "type_and_size":/^(?:Size\/Type:)?\s*(fine|diminutive|tiny|small|medium|large|huge|gargantuan|colossal) ([a-zA-Z0-9 ]+)/ig,
        "hitdie":/^Hit Dice:\s*([\d]+d[\d]+[-+ \d]*)/ig,
        "initmiscmod":/^Initiative:\s*(.+)$/ig,
        "speed":/^Speed:\s*([-+\d]+)/ig,
        "ac": /^Armor Class:\s*([\d]+)/ig,
        "touch":/touch ([\d]+)/ig,
        "flat-footed":/flat-footed ([\d]+)/ig,
        "bab_and_grapple":/^Base Attack\/Grapple:\s*([-+]*[\d]+)\/([-+]*[\d]+)/ig,
        "attack":/^Attack:\s*(.+)$/ig,// Further processing required.
        "full_attack":/^Full Attack:\s*(.+)$/ig,// Further processing required.
        "space_and_reach":/^Space\/Reach:\s*([\d]+) ft.\/([\d]) ft.$/ig,
        "special_attacks":/^Special Attacks:\s*(.+)$/ig,// Further processing required.
        "special_qualities":/^Special Qualities:\s*(.+)$/ig,// Further processing required.
        "fortitude":/^Saves:\s*.*Fort ([-+][\d]+)/ig,
        "reflex":/^Saves:\s*.*Ref ([-+][\d]+)/ig,
        "will":/^Saves:\s*.*Will ([-+][\d]+)/ig,
        "saves_line":/^Saves: (.+)$/ig,
        "str-base":/Str ([\d]+),/ig,
        "dex-base":/Dex ([\d]+),/ig,
        "con-base":/Con ([\d]+),/ig,
        "int-base":/Int ([\d]+),/ig,
        "wis-base":/Wis ([\d]+),/ig,
        "cha-base":/Cha ([\d]+)/ig,
        "skills_line":/^Skills:\s*(.+)$/ig,
        "feats":/^Feats:\s*(.+)$/ig,
        "organization":/^Organization:\s*(.+)$/ig,
        "level":/^Challenge Rating:\s*([\d]+)/ig, 
        "treasure":/^Treasure:\s*(.+)$/ig,
        "alignment":/^Alignment:\s*(.+)$/ig,
        "img":/^(http.+)$/g,
        "img2":/^<a href=\"(.+)\">/g,
        "misc":/^(Advancement:\s*.+)$/ig,
    };
    MonsterManager.LogAndNotify("Importing Monsters...");
    handout.get("notes", function(text) {
    text = text.replace(new RegExp("�V", "g"), "-"); // Replace impostor with the real deal.
        var lines = text.split("<br>");
        MonsterManager.LogAndNotify("Processing " + lines.length + " lines of text...");
        log(handout);
        for(var i=0;i < lines.length;i++) {
            var monster = {};
            var processing = "";
            var matchedLine = false;
        var curText = ""; // Buffer monster text for extended processing.
            while(i < lines.length) {
                var match = null;
                var rr;
                if (lines[i].indexOf("===") !== -1) { // Reset
                    break;
                }
                if (typeof(monster["name"]) == "undefined") { // First line is always monster name.
                    monster["name"] = lines[i];
                    monster["name"] = monster["name"].toLowerCase();
    		    monster["name"] = monster["name"].capitalizeFirstLetter();
                    processing = match = "name";
                    MonsterManager.LogAndNotify("Importing " + monster["name"] + "...");
                }
                else if ((rr=regexMap["type_and_size"].exec(lines[i]))) {
                    monster["racetype"] = rr[2];
                    var sizes =["Colossal", "Gargantuan", "Huge", "Large", "Medium" ,"Small", "Tiny", "Diminutive", "Fine"];
                    monster["size"] = sizes.indexOf(rr[1]) - 4;
                    processing = match = "type_and_size";
                }
                else if ((rr = regexMap["bab_and_grapple"].exec(lines[i]))) {
                    monster["bab"] = rr[1];
                    monster["grapple"] = rr[2];
                    processing = match = "bab_and_grapple";
                }
                else if ((rr = regexMap["space_and_reach"].exec(lines[i]))) {
                    monster["space"] = rr[1];
                    monster["reach"] = rr[2];
                    processing = match = "space_and_reach";
                }
                else {
                    for(obj in regexMap) {
                        rr=regexMap[obj].exec(lines[i]);
                        if (typeof(monster[obj]) == "undefined" && rr) {
                            monster[obj] = rr[1];
                            processing = match = obj;
                            break;
                        }
                    }
                    if (processing && !match && !matchedLine) {
			// MonsterManager.LogAndNotify("Further processing " + processing + ": " + lines[i]);
                        monster[processing] += " " + lines[i];
                        
                    }
                    else if (!match && !matchedLine && !processing) { 
                        MonsterManager.LogAndNotify(typeof(monster["hd"]));
                        MonsterManager.BadLine(monster["name"], lines[i]);
                        return;
                    }
                }
                if (!match || (match != null && partialMatches.indexOf(match) == -1) || (matchedLine && !match)) {
                    //log("Match " + match + " was not in partial matches.");
                    i++;
                    matchedLine = false;
                }
                else {
                    //log("Match " + match + " was in partial matches. Reprocessing...");
                    matchedLine = true;
                }
		curText += lines[i]+"<br>";
            }
            // Finished loading monster. Perform post-processing...
            // Attacks
            var img = monster["img"] || monster["img2"];
            if(!img) {
                img = "";//MonsterManager.defaultAvatar;
            }
	    // Check to ensure that nothing critical is missing...
	    for(var j=0;j<MonsterManager.mandatoryFields.length;j++) {
		if (typeof(monster[MonsterManager.mandatoryFields[j]]) == "undefined") {
		    MonsterManager.LogAndNotify("WARNING: Import failed for " + monster["name"] + ". Missing mandatory field "+MonsterManager.mandatoryFields[j]+".");
		    return;
		}
	    }
	    // Modify values to match character sheet
	    if (typeof(monster["dex-base"]) != "undefined") { // Initiative
		log("Init:" + monster["initmiscmod"] + ", dex:"+monster["dex-base"]);
		monster["initmiscmod"] = parseInt(monster["initmiscmod"]);
		monster["initmiscmod"] -= Math.floor((parseInt(monster["dex-base"]) - 10)/2);
	    }

	    // Create the monster's character sheet.
            var character = MonsterManager.CreateCharacter(monster, img);
	    // Set up special attack macro's
	    monster["special_attacks"] = MonsterManager.ProcessSpecialAttack(monster, character, monster["special_attacks"], curText);
	    // Set up attack macro's
	    monster["attack"] = MonsterManager.ProcessAttack(monster, character, monster["attack"], "Single", curText);
	    monster["full_attack"] = MonsterManager.ProcessAttack(monster, character, monster["full_attack"], "Full", curText);
	    // Fill in abilities (Token macro's)
            MonsterManager.CreateAbilities(character, monster);
        }
    });
}

MonsterManager.GetOrCreate = function(type, name, opt) {
    var ret = findObjs(mergeArray({
        _type:type,
        name:name
    }, opt));
    if (ret.length < 1) {
        ret = createObj(type, mergeArray({
            name: name,
        }, opt));
    }
    else {
        ret = ret[0];
    }
    return ret;
}


MonsterManager.CreateAbility = function(opt, monster, ab, name, value) {
    if (typeof(monster[ab]) !== "undefined") {
	var ability = MonsterManager.GetOrCreate("ability", name , opt);
	ability.set("action", value);
    }
}

MonsterManager.CreateAbilities = function(character, monster) {
    var opt = {
        characterid: character.get("_id"),
        istokenaction: true,
    };
    MonsterManager.CreateAbility(opt, monster, "fortitude", "fort", "/w gm Fort Save: [[1d20 @{fortitude}]]");
    MonsterManager.CreateAbility(opt, monster, "reflex",  "ref","/w gm Reflex Save: [[1d20 @{reflex}]]");
    MonsterManager.CreateAbility(opt, monster, "will", "will", "/w gm Will Save: [[1d20 @{will}]]");
    MonsterManager.CreateAbility(opt, monster, "grapple", "grapple", "/w gm Grapple Check: [[1d20 @{grapple}]]");

    // No longer needed (Initiatives are now calculated correctly). Delete this after verification. 
    // Still needed for now - The other roll is public, and tips 'monster name' and such.
    MonsterManager.CreateAbility(opt, monster, "initiative", "init", "/w gm Init: [[1d20 @{initiative} &{tracker}]]");
    
    //MonsterManager.LogAndNotify("Ability: " + JSON.stringify(ability));
}

MonsterManager.CreateCharacter = function(monster, img) {
    var character = findObjs({
        _type:"character",
        name: "y_"+monster["name"],
    });
    if (character.length > 1) {
        MonsterManager.LogAndNotify("WARNING: Found more than one character sheet for monster '"+monster["name"]+"'");
    }
    if (character.length >= 1) {
        character = character[0];
        MonsterManager.LogAndNotify("Updating character for " + monster["name"]);
    }
    else {
        MonsterManager.LogAndNotify("Creating new character for " + monster["name"]);
        character = createObj("character", {
            name: "y_"+monster["name"],
            avatar: img,
            gmnotes: JSON.stringify(monster),
        });
        //MonsterManager.LogAndNotify(JSON.stringify(character));
        createObj("attribute", {
            characterid: character.get("_id"),
            name: MonsterManager.safetyKey,
            current: MonsterManager.safetyValue,
        });
    }
    for(m in monster) {
        var attr = findObjs({
            _type:"attribute",
            characterid:character.get("id"),
            name: m
        });
        if (attr.length < 1) {
            attr = createObj("attribute", {
                name: m,
                characterid:character.get("_id"),
                current: monster[m],
                max: monster[m],
            });
        }
        else {
            // MonsterManager.LogAndNotify("Updating attribute " + m);
            attr[0].set("current", monster[m]);
            attr[0].set("max", monster[m]);
        }
    }
    return character;
}

MonsterManager.CreateAttackMacro = function(character, name, str) {
    str = str.replace(/\n$/,"");
    var opt = {
        characterid: character.get("_id"),
        istokenaction: true,
    };
    MonsterManager.CreateAbility(opt, {"x":"x"}, "x", name, str);
}

MonsterManager.ProcessAttack = function(monster, character, str, prefix, misc) {
    var attackRegex = /^\s*([\d]*)\s*([a-zA-Z0-9 ]+)\s*([-+][\d]+)\s*([a-zA-Z ]+)\s*\(?([-+d\d ]*)([a-zA-Z ]*)\)?.*$/;
    var seperatorRegex = /\s*(and|or)(?![a-zA-Z])\s*/ig;
    log("Processing " + str);
    var attacks = str.split(seperatorRegex);
    log(JSON.stringify(attacks));
    var ret = {};
    var baseAttStr;
    var attStr = baseAttStr =  "/w gm &{template:default} {{name="+character.get("name").replace("y_","")+" "+prefix+" attack}} ";
    var attName = "";
    for(var i=0;i<attacks.length;i++) {
	var special = false; // Are we processing a special attack?
        var attack = attacks[i];
        var dr = seperatorRegex.exec(attack);
        if (dr) {
            if(dr[1] == "and") {
		
	    }
	    else { // or
		MonsterManager.CreateAttackMacro(character, prefix+attName, attStr);
		attName = "";
		attStr = baseAttStr;
	    }
            continue;
        }
        var ar = attackRegex.exec(attack);
        if(!ar) {
            MonsterManager.BadLine("Attack", attack);
	    return;
        }
        var name = ar[2].replace(" ","").replace(/s$/, "");
	attName += name.toLowerCase().capitalizeFirstLetter();
        ret[name] = {};
        ret[name]["count"] = ar[1];
        ret[name]["mod"] = ar[3];
        ret[name]["type"] = ar[4];
        ret[name]["damage"] = ar[5];
	ret[name]["text"] = ar[6];
	if (!(ret[name]["count"] >= 1)) {
	    ret[name]["count"] = 1;
	}
	var dmgStr = "[["+ret[name]["damage"]+"]]"
	if (ret[name]["damage"] == "") {
	    dmgStr = "(Special Attack)";
	    special = true;
	}
	for(var j=0;j<ret[name]["count"];j++) {
	    var tmp = "";
	    if (j >= 1)
		tmp = " " + (j+1);
	    attStr += "{{" + name+tmp+"=[[1d20 "+ret[name]["mod"]+"]] for "+dmgStr+ " "+ ret[name]["text"] + "}} ";
	}
	if (special) {
	    attStr += MonsterManager.FindExtendedInfo(monster, ar[2] /* Look for unprocessed name */, misc, true); 
	}
    }
    
    MonsterManager.CreateAttackMacro(character, prefix+attName, attStr);
    return ret;
}

MonsterManager.FindExtendedInfo = function(monster, attack, misc, useIndent) {
    // Attempt to find extended information, if available.
    var exReg= new RegExp("<br>("+attack+")\\s*\\((Ex|Su|Ps|Sp)\\):?(.+?)<br>[a-zA-Z ]*(Spells|Skills|\\((Ex|Su|Ps|Sp)\\))", "ig");
    // var exReg = new RegExp("<br>("+attack+")\\s*\\((Ex|Su|Sp|Ps)\\):?(.+?\\.)<br>","ig");
    var rr = exReg.exec(misc);
    if (rr) {
	var ret = "{{Type" + ((useIndent)?"=":":") + rr[2] + "}} ";
	ret += "{{"+((useIndent)?"=":"") + rr[3] + "}} ";
	// Strip all <br>'s that aren't preceded by a '.'.
	ret = ret.replace(/([^\.])<br>/g, function(match, x, string) {
	    return x + " ";
	}).replace(/\\n/g," ");
	// Set up nicer paragraph formatting for those remaining.
	ret = ret.replace(/<br>/g,"<br><br>");
	// Attempt to contextually set up rolls. WIP
	ret = ret.replace("grapple", "grapple 1d20 "+monster["grapple"]+"");
	// Substitute rolls.
	ret = ret.replace(/([-+\d ]+d[-+\d ]+)/ig, function(match, roll, string) {
	    return "[["+roll+"]] ";
	});
	return ret;
    }
    return "";
}


MonsterManager.ProcessSpecialAttack = function(monster, character, str, misc) {
    var divider = /\s*,\s*/ig;
    var attackRegex = /^\s*(.*)\s*([-+\d ]+d[-+\d ]+)\s*(.*)\s*$/;
    var attacks = str.split(divider);
    var attStr = "";
    var baseAttStr;
    var attStr = baseAttStr =  "/w gm &{template:default} {{name="+character.get("name").replace("y_","")+": NAME}} ";
    var ret = {};
    var ex = "";
    for(var i=0;i<attacks.length;i++)  {
	var ar = attackRegex.exec(attacks[i]);
	if (ar) {
	    var name;
	    if (ar[1].length > ar[3].length)
		name = attName = ar[1];
	    else
		name = attName = ar[3];
	    ret[name] = {};
	    ret[name]["damage"] = ar[2];
	    // Is extended information available?
	    if ((ex = MonsterManager.FindExtendedInfo(monster, name, misc)))
		attStr += ex;
	    else // Use damage for attack roll if extended information could not be found.
		attStr += "{{" + name+"=[["+ret[name]["damage"]+"]] damage }}";

	}
	else {
	    attName = attacks[i];
	    // Is extended information available?
	    if ((ex = MonsterManager.FindExtendedInfo(monster, attName, misc)))
		attStr += ex;
	    else { // If not, give up.
		attStr += "{{Name="+attName+"}} ";
		attStr += "{{Status=No information could be discovered for this special attack. Look at your notes.}}";
	    }
	}
	if (attName != "")
	    MonsterManager.CreateAttackMacro(character, attName, attStr.replace("NAME", attName));
	attName = ex = "";
	attStr = baseAttStr;
    }
    return ret;
}


MonsterManager.LogAndNotify = function(text) {
    sendChat("Monster Manager", "/w gm " + text);
    log("[MM]: " + text);
}

MonsterManager.Generate = function(selected, monster) {
    var char = findObjs({
        _type:"character",
        name:"y_"+monster
    });
    if (char.length < 1) {
        MonsterManager.LogAndNotify("No such monster found.");
        return;
    }
    char = char[0];
    for(var i=0;i<selected.length;i++) {
        var token = getObj("graphic", selected[i]._id);
        if (!token) {
            MonsterManager.LogAndNotify("Failed to look up token: " + selected[i]._id);
            continue;
        }
        token.set("represents", char.get("_id"));
        token.set("name", monster);
        // Set AC
        token.set("bar3_value", getAttrByName(char.get("_id"), "ac"));
	// Process special qualities
	var qualities = getAttrByName(char.get("_id"), "special_qualities");
	if (qualities) {
	    var size = getAttrByName(char.get("_id"), "size") || 0;
	    if (size != 0) {
		size = parseInt(size) * -1;
		if (size < 0)
		    size = 0;
	    }
	    token.set("gmnotes", qualities.split(",").join("<br>"));
	    if (typeof(gmn.SetPopupData) == "function") // Only exploit this functionality if gmnotes is loaded
		gmn.SetPopupData(qualities.split(","), token, gmn.gmNotesBar, size);
	}

        // Set hitpoints in callback
        sendChat(selected[i]._id, "/w gm [["+getAttrByName(char.get("_id"), "hitdie")+"]]", function(msg) {
            var t = getObj("graphic", msg[0].who);
            if (typeof(msg[0]["inlinerolls"]) == "undefined") {
                MonsterManager.LogAndNotify("Failed to generate hitpoint roll for creature!");
                return;
            }
            var hp = msg[0]["inlinerolls"]["1"]["results"]["total"];
            t.set("bar1_value", hp);
            t.set("bar1_max", hp);
        });
    }
    MonsterManager.LogAndNotify("Created " + selected.length + " " + monster + "'s");
}

on("chat:message", function(msg) {   
    if (msg.type == "api" && msg.content.indexOf("!monster") !== -1) {
        var reg = /^!monster (import|generate|clear-all) ?([-a-zA-Z0-9 _]*)$/ig;
        var cmd = reg.exec(msg.content);
        if (!cmd) {
            MonsterManager.ShowUsage(msg);
            return;
        }
        var operation = cmd[1];
        var args=cmd[2];
        if (operation == "import" && playerIsGM(msg.playerid)) {
            var mmi = findObjs({                              
		_type: "handout",
		name: importName
            });
            if (mmi.length != 1 || typeof(mmi[0]) == "undefined") {
		MonsterManager.LogAndNotify("Failed to locate import handout! No handout named '"+importName+"' exists (Or more than one handout matching this name was found).");
		return;
            }
            mmi = mmi[0];
            MonsterManager.Import(cmd, args, mmi);
        }
        else if (operation == "generate") {
            if (!args) {
                MonsterManager.LogAndNotify("The 'generate' operation requires a monster to be specified.");
                return;
            }
            if (typeof(msg.selected) == "undefined") {
                MonsterManager.LogAndNotify("The 'generate' operation requires at least one token to be selected.");
                return;
            }
            MonsterManager.Generate(msg.selected, args);
        }
        else if (operation == "clear-all" && playerIsGM(msg.playerid) ) {
            var allChars = findObjs({
                _type: "attribute",
                name: MonsterManager.safetyKey
            });
            for(var i=0;i<allChars.length;i++) {
		if (typeof(allChars[i]) == "undefined") { // wtf m8
		    MonsterManager.LogAndNotify("Failed to look up " + JSON.stringify(allChars[i])+ " for deletion.");
		    return;
		}
		var char = getObj("character", allChars[i].get("characterid"));
		if(typeof(char) == "undefined") {
		    MonsterManager.LogAndNotify("Failed to look up " + JSON.stringify(allChars[i])+ " for deletion.");
		    return;
		    continue;
		}
		var name = char.get("name");
		if (/^y_.+$/g.exec(name)) {
                    // Final safety check
                    if (allChars[i].get("current") == MonsterManager.safetyValue) {
			MonsterManager.LogAndNotify("Deleting " + name);
			char.remove();
                    }
		}
            }
        }
        else {
            MonsterManager.LogAndNotify(operation);
            MonsterManager.ShowUsage(msg);
        }
    }
});
