// ══ RULEBOOKS, SEARCH & PLAYER TAGS (v5.67.0) ════════════════════════
// Rule summaries are written for Innings in plain English and link out
// to each league's official rulebook, which stays the final word. The
// data ships inline (window.INNINGS_RULES, generated) so the deploy is
// still one file; it's ~27KB and the same for everyone.
window.INNINGS_RULES = {"books":{"mlb":{"name":"Official Baseball Rules","sections":[{"id":"def","num":"Def","title":"Definitions","blurb":"The terms everything else leans on — infield fly, force, tag, obstruction."},{"id":"play","num":"5","title":"Playing the game","blurb":"Pitching, batting, running the bases and how outs are made."},{"id":"improper","num":"6","title":"Improper play","blurb":"Balks, interference, obstruction and illegal pitches."},{"id":"end","num":"7","title":"Ending the game","blurb":"Regulation games, extra innings, suspended and shortened games."},{"id":"pace","num":"Pace","title":"Pace of play & modern rules","blurb":"The pitch clock, pickoff limits, shift limits and challenges."},{"id":"score","num":"9","title":"Scoring","blurb":"How the official scorer credits hits, errors, RBIs and saves."}],"rules":[{"id":"infield-fly","sec":"def","title":"Infield fly rule","sum":"With runners on first and second (or the bases loaded) and fewer than two outs, a fair pop-up an infielder can catch with ordinary effort is an automatic out once the umpire calls it. It stops a fielder from dropping the ball on purpose to turn a cheap double play.","watch":["The umpire points up and calls it while the ball is in the air.","Runners may advance at their own risk, like on any caught fly.","Line drives and bunts never count."],"kw":"pop up popup fly","rx":"infield fly"},{"id":"tag-up","sec":"play","title":"Tagging up","sum":"On a caught fly ball, a runner has to be touching his base when the ball is first touched before he can advance. Leave early and the defense can appeal by throwing to that base for an out.","watch":["Runners on third often go on a medium-deep fly — that's a sacrifice fly if he scores.","A runner who didn't tag and gets thrown back out is 'doubled off'."],"kw":"sac fly advance tag","rx":"tag(s|ged)? up|doubled off"},{"id":"sac-fly","sec":"score","title":"Sacrifice fly","sum":"A fly ball caught for an out that lets a runner score. The batter gets an RBI and isn't charged with an at-bat, so it doesn't hurt his average.","watch":[],"kw":"rbi at bat average","rx":"sacrifice fly"},{"id":"fielders-choice","sec":"score","title":"Fielder's choice","sum":"When the defense chooses to put out a different runner instead of the batter, the batter reaches base but isn't credited with a hit.","watch":["It's why a batter can reach first and still go 0-for-1."],"kw":"fc hit","rx":"fielder'?s choice|force(d)? out"},{"id":"dropped-third","sec":"play","title":"Dropped third strike","sum":"If the catcher doesn't cleanly catch strike three, the batter can try to run to first — as long as first base is open or there are two outs. The pitcher still gets the strikeout.","watch":["That's how a pitcher can record four strikeouts in one inning."],"kw":"strikeout wild pitch passed ball","rx":"strikes out on a (wild pitch|passed ball)|dropped third strike|reaches on a (wild pitch|passed ball)"},{"id":"ground-rule-double","sec":"play","title":"Ground-rule double","sum":"A fair ball that bounces over the fence or gets stuck in it is an automatic double, and every runner moves up exactly two bases.","watch":["A runner on first can't score on it, even if he'd have made it easily."],"kw":"bounce fence","rx":"ground-rule double"},{"id":"balk","sec":"improper","title":"Balk","sum":"An illegal motion by the pitcher with runners on base — usually starting his delivery and stopping, or not coming set. Every runner moves up one base.","watch":["The pitcher has to come to a full stop in the set position before pitching.","He can't fake a throw to first."],"kw":"pitcher motion runner advance","rx":"balk"},{"id":"obstruction","sec":"improper","title":"Obstruction vs. interference","sum":"Obstruction is a fielder without the ball getting in a runner's way — the runner is usually awarded the base he'd have reached. Interference is the offense getting in the defense's way — usually an out.","watch":["Catcher's interference sends the batter to first.","A runner hit by a batted ball is out."],"kw":"catcher interference","rx":"obstruct|interference"},{"id":"extra-innings","sec":"end","title":"Extra innings","sum":"A game tied after nine innings keeps going one full inning at a time until a team leads at the end of one. Regulation games can't end in a tie, and the home team always gets its last turn at bat.","watch":["In the regular season every extra half-inning starts with a runner on second. In the postseason there's no automatic runner — it's straight baseball.","Long games often end with position players pitching once a bullpen runs dry."],"kw":"extras tie 10th 11th overtime","rx":"extra innings"},{"id":"walk-off","sec":"end","title":"Walk-offs","sum":"Once the home team takes the lead in the bottom of the 9th or any extra inning, the game ends on the spot. Only the winning run counts — unless the ball leaves the park, when the batter and every runner score.","watch":["On a walk-off hit, the batter is credited with only as many bases as the winning runner needed, so a ball off the wall can go in the book as a single.","A walk-off grand slam counts all four runs."],"kw":"walkoff game over winning run bottom ninth","rx":"walk-?off"},{"id":"no-bottom-ninth","sec":"end","title":"Skipping the bottom of the 9th","sum":"If the home team is ahead after the top of the 9th, it doesn't bat again — the game is over. That's why a losing road pitcher can throw a complete game in eight innings.","watch":[],"kw":"bottom ninth home team lead final"},{"id":"extra-runner","sec":"end","title":"Automatic runner in extra innings","sum":"In the regular season, each half-inning after the 9th starts with a runner on second base — the player who made the last out the inning before. It doesn't apply in the postseason.","watch":["If that runner scores, the run is unearned for the pitcher."],"kw":"extra innings ghost runner zombie runner","rx":"automatic runner|(starts|placed|begins) (the inning )?on second"},{"id":"regulation","sec":"end","title":"Rain-shortened games","sum":"A game becomes official after five innings — or four and a half if the home team is ahead. Called before that, it's suspended and picked up later from the same spot.","watch":["A game called while tied — even after five innings — isn't a tie. It's suspended and finished later from the same spot."],"kw":"rain delay suspended official","rx":"suspended|shortened|rain"},{"id":"pitch-clock","sec":"pace","title":"Pitch clock","sum":"Pitchers get 15 seconds with the bases empty and 18 with runners on to start their motion. Batters must be in the box and alert by eight seconds left. Miss it and it's an automatic ball (pitcher) or strike (batter).","watch":["The clock resets after a pickoff attempt or step-off."],"kw":"timer violation pace","rx":"pitch clock|timer violation|automatic (ball|strike)"},{"id":"pickoffs","sec":"pace","title":"Pickoff limit","sum":"A pitcher gets two disengagements — pickoff throws or step-offs — per plate appearance. A third that doesn't get the runner out is a balk.","watch":["It's a big part of why stolen bases came back."],"kw":"step off disengagement steal","rx":"pick(ed)? ?off|disengagement"},{"id":"shift","sec":"pace","title":"Shift limits","sum":"When the pitch is thrown, the defense needs two infielders on each side of second base and all four with both feet on the infield dirt.","watch":[],"kw":"infield positioning defense"},{"id":"challenges","sec":"pace","title":"Replay review & ball-strike challenges","sum":"Managers can challenge most calls on the bases and fair/foul with replay. With the automated ball-strike system, the batter, pitcher or catcher can challenge a called ball or strike by tapping their head — a team keeps its challenge if it wins.","watch":["Umpires still call pitches; the system only rules on challenges."],"kw":"abs replay review overturned robot umpire","rx":"challenge|review|overturned|call (stands|confirmed)"}]},"football":{"name":"Football rules","sections":[{"id":"score","num":"Score","title":"Scoring","blurb":"Touchdowns, field goals, safeties and the try after."},{"id":"pass","num":"8","title":"Passing & catching","blurb":"What a catch is, interference and grounding."},{"id":"time","num":"4","title":"Game timing","blurb":"The clock, timeouts, the two-minute warning and overtime."},{"id":"fouls","num":"12","title":"Common penalties","blurb":"Holding, false starts, roughing and more."},{"id":"kick","num":"Kick","title":"Kicking plays","blurb":"Kickoffs, punts, touchbacks and fair catches."},{"id":"review","num":"Replay","title":"Replay & challenges","blurb":"What coaches can challenge and what's reviewed automatically."}],"rules":[{"id":"td","sec":"score","title":"Touchdown","sum":"Six points when a runner with possession breaks the plane of the goal line, or a receiver completes a catch in the end zone.","watch":["The ball only has to touch the plane — the player doesn't."],"kw":"score six end zone"},{"id":"try","sec":"score","title":"Extra point & two-point try","sum":"After a touchdown, a team kicks for one point or runs a play from close in for two. The NFL snaps the kick from the 15 and the two-point try from the 2; college snaps both from the 3.","watch":[],"kw":"pat conversion extra point","rx":"two-point|2-pt|two point"},{"id":"safety","sec":"score","title":"Safety","sum":"Two points for the defense when the offense is downed in its own end zone, or commits a foul there. The team that gave it up then kicks off from its own 20.","watch":[],"kw":"two points end zone","rx":"safety"},{"id":"catch","sec":"pass","title":"What counts as a catch","sum":"A receiver has to control the ball, get two feet (or another body part) down in bounds, and hold it long enough to make a football move. Lose it on the way to the ground before all that and it's incomplete.","watch":["Most catch reviews come down to control while going to the ground."],"kw":"reception incomplete control two feet","rx":"ruled (a )?catch|ruled incomplete|catch (was )?(reversed|overturned)","notes":{"cfb":"College only needs one foot in bounds."}},{"id":"dpi","sec":"pass","title":"Pass interference","sum":"Illegal contact with a receiver while the ball is in the air that restricts his chance to catch it. In the NFL, defensive pass interference is a spot foul — the ball goes where it happened — plus a first down.","watch":["Offensive pass interference costs 10 yards.","Contact before the ball is thrown is usually holding or illegal contact instead."],"kw":"dpi opi flag","rx":"pass interference","notes":{"cfb":"In college, defensive pass interference is capped at 15 yards."}},{"id":"grounding","sec":"pass","title":"Intentional grounding","sum":"A passer under pressure throws the ball away with no eligible receiver nearby. It's a loss of down and 10 yards or a spot foul — unless he's outside the tackle box and the ball reaches the line of scrimmage.","watch":[],"kw":"throw away sack","rx":"intentional grounding"},{"id":"two-min","sec":"time","title":"Two-minute warning","sum":"An automatic timeout at two minutes left in each half. It gives the trailing team a free clock stoppage.","watch":[],"kw":"clock stoppage","rx":"two-minute warning","only":["nfl"]},{"id":"clock","sec":"time","title":"When the clock stops","sum":"The clock stops on incompletions, when a runner goes out of bounds, on scores, and on timeouts and penalties. Each team gets three timeouts per half.","watch":[],"kw":"timeout out of bounds","notes":{"cfb":"College also stops the clock briefly after first downs, but only in the last two minutes of each half."}},{"id":"ot","sec":"time","title":"Overtime","sum":"NFL overtime starts with a coin toss, and both teams are guaranteed a possession — a touchdown on the opening drive no longer ends it. After both have had the ball, the next score wins. Regular-season overtime is one 10-minute period and can end in a tie; playoff overtime is full 15-minute periods until someone wins.","watch":["The defense can still end it on the first possession with a safety or a return for a touchdown.","Each team gets two timeouts in regular-season overtime. In the playoffs it's three for every two overtime periods, like a half.","There are no coach's challenges in overtime — the replay booth handles every review.","In the playoffs, if the score is tied or the second team hasn't had its chance when 15 minutes run out, play rolls straight into a second overtime."],"kw":"sudden death tie coin toss possession","rx":"overtime|\\bOT\\b","notes":{"cfb":"College has no clock in overtime and no ties. Each team gets a possession from the other team's 25. Starting in the second overtime a touchdown must be followed by a two-point try, and from the third overtime on it's a shootout of alternating two-point plays."}},{"id":"holding","sec":"fouls","title":"Holding","sum":"Grabbing or hooking an opponent to keep him from making a play. Offensive holding is 10 yards; defensive holding is 5 yards and an automatic first down.","watch":[],"kw":"flag penalty","rx":"holding"},{"id":"false-start","sec":"fouls","title":"False start, offside & encroachment","sum":"Before the snap, an offensive player can't move once set (false start, 5 yards, dead ball). A defender who crosses the line early is offside or in the neutral zone — also 5 yards.","watch":["If a defender jumps and the quarterback snaps it anyway, the offense gets a free play."],"kw":"flag pre-snap jump","rx":"false start|offside|encroachment|neutral zone"},{"id":"roughing","sec":"fouls","title":"Roughing the passer","sum":"Hitting the quarterback late, low at the knees, in the head or neck, or landing on him with full body weight after he throws. It's 15 yards and an automatic first down.","watch":[],"kw":"late hit quarterback flag","rx":"roughing the passer"},{"id":"targeting","sec":"fouls","title":"Targeting","sum":"Forcible contact to the head or neck of a defenseless player, or leading with the crown of the helmet. It's 15 yards and the player is ejected; replay reviews every call.","watch":["A player flagged in the second half also misses the first half of the next game."],"kw":"ejection helmet","rx":"targeting","only":["cfb"]},{"id":"touchback","sec":"kick","title":"Touchback","sum":"A kick or turnover downed in the end zone. On punts the ball comes out to the 20.","watch":[],"kw":"end zone kneel","rx":"touchback","notes":{"nfl":"NFL kickoff touchbacks come out to the 35 under the current kickoff rules.","cfb":"College kickoff touchbacks come out to the 25."}},{"id":"fair-catch","sec":"kick","title":"Fair catch","sum":"A returner waves his hand above his head to signal he won't run. He can't be hit, and the ball is dead where he catches it.","watch":[],"kw":"punt return wave","rx":"fair catch"},{"id":"challenge","sec":"review","title":"Coach's challenge","sum":"NFL coaches throw a red flag to challenge a call — two per game, and a third if both are won. Scoring plays and turnovers are reviewed automatically. A lost challenge costs a timeout.","watch":[],"kw":"red flag replay review overturned","rx":"challenge|review|overturned|upheld|stands","notes":{"cfb":"In college, a replay official in the booth can stop any play to review it; each coach also gets one challenge."}},{"id":"untimed-down","sec":"time","title":"Untimed down","sum":"A half can't end on an accepted defensive foul. If time runs out on the play, the offense gets one more snap with no time on the clock.","watch":["It's how a team gets a last-second field goal try after pass interference on a Hail Mary."],"kw":"end of half final play zero clock","rx":"untimed down"}]},"basketball":{"name":"Basketball rules","sections":[{"id":"time","num":"5","title":"Scoring & timing","blurb":"Quarters, overtime and how points are scored."},{"id":"clock","num":"7","title":"Shot clock","blurb":"24 seconds and when it resets."},{"id":"viol","num":"10","title":"Violations","blurb":"Traveling, three seconds, backcourt and the rest."},{"id":"goal","num":"11","title":"Goaltending","blurb":"Touching a shot on its way down or on the rim."},{"id":"fouls","num":"12","title":"Fouls & free throws","blurb":"Personal, shooting, flagrant and technical fouls."},{"id":"review","num":"13–14","title":"Replay & challenges","blurb":"What gets reviewed and the coach's challenge."}],"rules":[{"id":"length","sec":"time","title":"Game length","sum":"NBA games are four 12-minute quarters. A shot from behind the arc is worth three.","watch":[],"kw":"quarters overtime three pointer","notes":{"wnba":"WNBA games are four 10-minute quarters.","cbb":"Men's college games are two 20-minute halves. The three-point line is 22 feet, 1¾ inches, a little shorter in the corners."}},{"id":"overtime","sec":"time","title":"Overtime","sum":"A game tied after regulation goes to a 5-minute overtime, then as many more as it takes — basketball has no ties. Each overtime starts with a jump ball, and players' personal fouls carry over.","watch":["The bonus comes faster: the 4th team foul of an overtime sends the other team to the line.","Each team gets two timeouts per overtime."],"kw":"ot extra period tie jump ball","rx":"overtime|\\bOT\\b","notes":{"wnba":"Same five minutes. Each team gets two timeouts plus one Reset timeout per overtime, and the 4th team foul of the period sends the other team to the line.","cbb":"Same five minutes, opened by a jump ball. Team fouls carry over from the second half, so a team already in the bonus stays there, and each team gets one extra timeout per overtime on top of any it saved."}},{"id":"shot-clock","sec":"clock","title":"Shot clock","sum":"The offense has 24 seconds to get a shot to hit the rim. An offensive rebound after the shot hits the rim resets it to 14.","watch":["Kicked balls and many fouls reset it too."],"kw":"24 violation","rx":"shot clock","notes":{"cbb":"College uses a 30-second shot clock. An offensive rebound resets it to 20 if fewer than 20 seconds are left."}},{"id":"travel","sec":"viol","title":"Traveling","sum":"Moving your pivot foot or taking too many steps without dribbling. A player gets two steps after gathering the ball.","watch":[],"kw":"steps walk","rx":"travel"},{"id":"three-sec","sec":"viol","title":"Three seconds","sum":"An offensive player can't stay in the lane for more than three seconds. Defenders can't either unless they're actively guarding someone — that one's a technical.","watch":[],"kw":"paint lane defensive","rx":"3[- ]second|three[- ]second"},{"id":"backcourt","sec":"viol","title":"Backcourt & 8 seconds","sum":"The offense has eight seconds to get the ball over half court, and once it's there it can't go back.","watch":[],"kw":"half court over and back","rx":"backcourt|8[- ]second|eight[- ]second","notes":{"cbb":"College gives the offense 10 seconds, not 8, to get over half court."}},{"id":"goaltending","sec":"goal","title":"Goaltending & basket interference","sum":"A defender can't touch a shot on its way down toward the basket or while it's on the rim. If he does, the basket counts. Offensive basket interference wipes a basket off.","watch":["Challenges on these are reviewable in the last two minutes."],"kw":"block rim","rx":"goaltending|basket interference"},{"id":"fouls","sec":"fouls","title":"Personal fouls & fouling out","sum":"Six personal fouls and a player is out of the game. After a team's fifth foul in a quarter (fourth in overtime), every foul sends the other team to the line — the bonus.","watch":[],"kw":"foul out bonus penalty free throws","rx":"fouled out|personal foul","notes":{"cbb":"Five fouls and a player is out. Team fouls count for the whole half: the 7th sends the other team to the line for a one-and-one (make the first to earn a second), the 10th for two shots. Overtime keeps counting from the second half."}},{"id":"flagrant","sec":"fouls","title":"Flagrant fouls","sum":"Unnecessary (flagrant 1) or unnecessary and excessive (flagrant 2) contact. Both give two free throws and the ball; a flagrant 2 is also an ejection.","watch":[],"kw":"ejection","rx":"flagrant"},{"id":"technical","sec":"fouls","title":"Technical fouls","sum":"Unsportsmanlike conduct or certain rule violations. The other team gets one free throw. Two technicals in a game is an ejection.","watch":[],"kw":"tech ejection","rx":"technical"},{"id":"take-foul","sec":"fouls","title":"Transition take foul","sum":"Fouling on purpose to stop a fast break, without playing the ball. The other team gets one free throw of their choosing and keeps the ball.","watch":[],"kw":"fast break","rx":"take foul|transition","only":["nba","wnba"]},{"id":"clear-path","sec":"fouls","title":"Clear path foul","sum":"A foul on a player with an open path to the basket after the defense lost the ball. It's two free throws plus the ball.","watch":[],"kw":"breakaway","rx":"clear path","only":["nba","wnba"]},{"id":"challenge","sec":"review","title":"Coach's challenge","sum":"A coach can challenge a foul, an out-of-bounds call or a goaltending call by calling timeout and twirling a finger. It costs the timeout; win it and the call is reversed.","watch":[],"kw":"replay review overturned","rx":"challenge|review|overturned","notes":{"cbb":"College coaches can challenge an out-of-bounds call, goaltending or basket interference, and whether a defender was in the restricted area. Losing one costs a timeout."}},{"id":"last-two","sec":"fouls","title":"Bonus in the last two minutes","sum":"A team that hasn't reached the bonus by the last two minutes of a quarter or overtime gets one foul to give. Its second foul in that stretch sends the other team to the line.","watch":["That's the 'foul to give' a team uses to stop the clock or break up a late possession."],"kw":"foul to give penalty free throws late","only":["nba","wnba"]},{"id":"buzzer","sec":"time","title":"Beating the buzzer","sum":"A shot counts if it's out of the shooter's hand before the horn and the light on the backboard. With 0.3 seconds or less left, there isn't time to catch and shoot — only a tip or an alley-oop can count.","watch":["Buzzer-beaters at the end of a quarter or the game are reviewed on replay."],"kw":"horn last shot buzzer beater tip","rx":"buzzer"}]},"hockey":{"name":"NHL Official Rules","sections":[{"id":"flow","num":"11","title":"Game flow","blurb":"Icing, offside, hand passes and faceoffs."},{"id":"pens","num":"4","title":"Penalties","blurb":"Minors, majors, the power play and delayed penalties."},{"id":"goals","num":"Goals","title":"Goals & review","blurb":"Goalie interference, kicked pucks and coach's challenges."},{"id":"ot","num":"OT","title":"Overtime & shootout","blurb":"Three-on-three, the shootout and playoff overtime."}],"rules":[{"id":"icing","sec":"flow","title":"Icing","sum":"Shooting the puck from your side of the red line all the way past the other team's goal line untouched. Play stops, the faceoff comes back to your zone, and you can't change lines.","watch":["It's waived when you're shorthanded.","Hybrid icing: a race to the faceoff dots decides whether it's called."],"kw":"red line goal line faceoff","rx":"icing"},{"id":"offside","sec":"flow","title":"Offside","sum":"An attacking player can't enter the offensive zone ahead of the puck. What counts is his skate — a skate on or over the blue line with the puck already across, or still touching the line, keeps him onside.","watch":["Coaches can challenge an offside that led to a goal."],"kw":"blue line zone entry","rx":"offside"},{"id":"hand-pass","sec":"flow","title":"Hand pass","sum":"Players can bat the puck with a hand in their own zone, but not to a teammate in the neutral or offensive zone. A goal off a hand pass doesn't count.","watch":[],"kw":"glove","rx":"hand pass"},{"id":"high-stick-puck","sec":"flow","title":"High stick on the puck","sum":"Touching the puck with a stick above the crossbar height stops play. A goal scored that way is disallowed.","watch":[],"kw":"crossbar","rx":"high[- ]stick(ed|ing)? the puck|high stick"},{"id":"minor","sec":"pens","title":"Minor penalties & the power play","sum":"Two minutes in the box for tripping, hooking, slashing, holding and the like. The other team plays with an extra skater, and a power-play goal ends the minor early.","watch":["A high stick that draws blood is a double minor — four minutes."],"kw":"power play penalty kill pp pk box","rx":"minor|tripping|hooking|slashing|holding|interference|roughing|cross-checking|high-sticking"},{"id":"major","sec":"pens","title":"Majors & fighting","sum":"Five minutes, and it doesn't end if the other team scores. Fighting is an automatic major.","watch":[],"kw":"fight five minutes","rx":"major|fighting"},{"id":"delayed","sec":"pens","title":"Delayed penalty","sum":"When the team that didn't commit the foul has the puck, the ref waits with an arm up. That team usually pulls its goalie for an extra attacker until the other team touches the puck.","watch":[],"kw":"extra attacker goalie pulled","rx":"delayed penalty"},{"id":"penalty-shot","sec":"pens","title":"Penalty shot","sum":"Awarded when a player on a clear breakaway is fouled from behind. The shooter goes one-on-one with the goalie.","watch":[],"kw":"breakaway","rx":"penalty shot"},{"id":"goalie-int","sec":"goals","title":"Goaltender interference","sum":"A goal doesn't count if an attacker impairs the goalie's ability to play his position in the crease — unless he was pushed in by a defender.","watch":[],"kw":"crease","rx":"goaltender interference|goalie interference"},{"id":"kicked","sec":"goals","title":"Kicked-in goals","sum":"A puck can go in off a skate, but not from a distinct kicking motion.","watch":[],"kw":"skate","rx":"kick(ed|ing)"},{"id":"challenge","sec":"goals","title":"Coach's challenge","sum":"Coaches can challenge a goal for offside or goaltender interference. A failed challenge is a two-minute minor for delay of game.","watch":[],"kw":"review overturned video","rx":"challenge|review|overturned"},{"id":"overtime","sec":"ot","title":"Regular-season overtime","sum":"A regular-season game tied after three periods gets five minutes of three-on-three, sudden death. Still tied, it goes to a shootout.","watch":["Teams switch ends for overtime, so the long change is back.","Coaches often pull the goalie in overtime for a four-on-three."],"kw":"3 on 3 sudden death","rx":"overtime|\\bOT\\b"},{"id":"shootout","sec":"ot","title":"Shootout","sum":"Each team sends three shooters, alternating, best of three. Still tied, it goes to sudden-death rounds, and nobody shoots twice until everyone on the bench but the goalies has gone. The winner gets one goal added to its final score.","watch":["Shootout goals don't count in players' or goalies' stats.","There are no shootouts in the playoffs."],"kw":"so skills breakaway tiebreaker","rx":"shootout"},{"id":"playoff-ot","sec":"ot","title":"Playoff overtime","sum":"Playoff games are never decided by a shootout. After a full intermission, teams play 20-minute periods of five-on-five, sudden death, for as long as it takes.","watch":["Ice is resurfaced before each playoff overtime, and penalties are called the same as in regulation."],"kw":"sudden death 2OT 3OT double triple overtime","rx":"(2|3|4|5)OT|double overtime|triple overtime"},{"id":"ot-penalties","sec":"ot","title":"Penalties in overtime","sum":"In three-on-three overtime a minor doesn't take a skater away — it gives the other team one. One penalty makes it four-on-three; two make it five-on-three.","watch":[],"kw":"power play 4 on 3 5 on 3"},{"id":"points","sec":"ot","title":"Points in the standings","sum":"A win is worth two points however it comes. A loss in overtime or the shootout is still worth one; a loss in regulation is worth none.","watch":["That loser point is why late-season games that go to overtime matter to three teams."],"kw":"standings otl loser point"},{"id":"empty-net","sec":"flow","title":"Pulling the goalie","sum":"A team trailing late often pulls its goalie for an extra attacker. A goal into the empty net counts like any other.","watch":[],"kw":"extra attacker empty net en","rx":"empty net"}]},"soccer":{"name":"IFAB Laws of the Game","sections":[{"id":"off","num":"11","title":"Offside","blurb":"When being ahead of the ball is — and isn't — an offence."},{"id":"fouls","num":"12","title":"Fouls & misconduct","blurb":"Handball, cards and denying a goal."},{"id":"restarts","num":"13–17","title":"Restarts","blurb":"Free kicks, penalties, throw-ins, corners and goal kicks."},{"id":"ref","num":"5","title":"The referee & VAR","blurb":"Advantage, video review and added time."},{"id":"end","num":"10","title":"Draws, extra time & penalties","blurb":"What happens when a match is level at full time."}],"rules":[{"id":"offside","sec":"off","title":"Offside","sum":"A player is offside if, when a teammate plays the ball to them, they're in the opponent's half and closer to the goal line than both the ball and the second-last defender — and they get involved in the play. Level counts as onside, and you can't be offside from a throw-in, goal kick or corner.","watch":["The flag goes up late on purpose so a wrong call can be fixed by VAR."],"kw":"flag linesman assistant referee","rx":"offside"},{"id":"handball","sec":"fouls","title":"Handball","sum":"It's a foul when a player deliberately handles the ball or makes their body unnaturally bigger with their arm. A goal scored directly off an attacker's hand, even by accident, doesn't count.","watch":[],"kw":"hand arm","rx":"hand ?ball"},{"id":"cards","sec":"fouls","title":"Yellow & red cards","sum":"A yellow card is a caution; two in one match makes a red. A straight red — for serious foul play, violent conduct, or denying an obvious goal-scoring chance — sends a player off, and the team plays a player down.","watch":["A red card usually means a suspension for the next match too."],"kw":"booked sent off caution ejection","rx":"yellow card|red card|booked|sent off|caution"},{"id":"shootout","sec":"end","title":"Penalty shootout","sum":"Teams alternate five kicks each from the spot. Level after five, it goes to sudden death, one kick apiece. Only players on the field at the final whistle can shoot, and nobody shoots twice until every eligible teammate — goalkeeper included — has taken one.","watch":["It can end early once one team can't catch up.","Shootout goals don't count toward a player's goal total; the match goes in the books as a draw won on penalties.","A team that finishes with more players trims down to match the other before it starts."],"kw":"pks penalties kicks from the mark","rx":"shoot-?out|on penalties|penalty kicks? shootout"},{"id":"pk","sec":"restarts","title":"Penalty kick","sum":"A direct-free-kick foul inside your own penalty area gives the other team a shot from the spot. The goalkeeper must keep part of one foot on the line until it's kicked.","watch":[],"kw":"spot kick box","rx":"penalty"},{"id":"keeper-8","sec":"restarts","title":"Keeper holding the ball","sum":"A goalkeeper can hold the ball in their hands for eight seconds. Longer than that and the other team gets a corner kick.","watch":[],"kw":"goalkeeper time wasting"},{"id":"restarts","sec":"restarts","title":"Throw-ins, goal kicks & corners","sum":"Out over the sideline is a throw-in to the team that didn't touch it last. Over the goal line, it's a goal kick if the attackers touched it last, a corner if the defenders did.","watch":[],"kw":"out of play sideline","rx":"throw-in|goal kick|corner kick"},{"id":"advantage","sec":"ref","title":"Advantage","sum":"If stopping play for a foul would hurt the team that was fouled, the referee lets play go on. The foul can still get a card later.","watch":[],"kw":"play on","rx":"advantage"},{"id":"var","sec":"ref","title":"VAR","sum":"A video assistant referee checks goals, penalties, straight red cards and mistaken identity. The on-field referee makes the final call, often after watching the monitor on the sideline.","watch":[],"kw":"video review check","rx":"\\bVAR\\b|video review|review"},{"id":"added-time","sec":"ref","title":"Added time","sum":"The referee adds time at the end of each half for substitutions, injuries, goal celebrations, VAR checks and time-wasting.","watch":[],"kw":"stoppage time injury time","rx":"added time|stoppage time"},{"id":"subs","sec":"ref","title":"Substitutions","sum":"Most top leagues allow five substitutes, made in no more than three stoppages during play plus halftime.","watch":[],"kw":"sub bench","rx":"substitution"},{"id":"draws","sec":"end","title":"Draws","sum":"A regular-season match that's level after 90 minutes plus added time is a draw — one point each, against three for a win. There's no extra time and no shootout.","watch":[],"kw":"tie level point standings"},{"id":"extra-time","sec":"end","title":"Extra time","sum":"In a knockout match that's level after 90 minutes, teams play two 15-minute halves of extra time, in full — a goal doesn't end it. Still level, it goes to penalties.","watch":["Teams get an extra substitute, and an extra window to use it, in extra time."],"kw":"overtime aet 120 minutes playoffs knockout","rx":"extra time","notes":{"mls":"MLS skips extra time in the Wild Card match and every Round One game: a tie after 90 minutes goes straight to penalties, and each Round One game counts as one win in a best-of-three. From the conference semifinals through MLS Cup, it's extra time, then penalties.","nwsl":"Every NWSL playoff game is single elimination: two full 15-minute periods of extra time, then penalties if it's still level."}}]},"tennis":{"name":"Tennis rules","sections":[{"id":"score","num":"Score","title":"Scoring","blurb":"Points, games, deuce and advantage."},{"id":"sets","num":"Sets","title":"Sets & tiebreaks","blurb":"Six games a set, the tiebreak and the deciding set."},{"id":"serve","num":"Serve","title":"Serving","blurb":"Faults, lets and foot faults."},{"id":"calls","num":"Calls","title":"Calls & conduct","blurb":"Electronic line calling, challenges, the serve clock and code violations."}],"rules":[{"id":"scoring","sec":"score","title":"Points, games & deuce","sum":"Points go love, 15, 30, 40, game. At 40-40 — deuce — a player has to win two points in a row: the first gives them advantage, the second wins the game.","watch":["A 'break' is winning a game on the other player's serve; a break point is one point away from it."],"kw":"love deuce ad advantage break point","rx":"deuce|advantage|break point"},{"id":"sets","sec":"sets","title":"Sets","sum":"A set goes to the first player to six games, but they have to win by two. At 6-5 they play on; at 6-6 it goes to a tiebreak.","watch":["Players switch ends after the first game and every two games after that."],"kw":"games set 6-4 7-5"},{"id":"tiebreak","sec":"sets","title":"Tiebreak","sum":"At 6-6, a tiebreak decides the set: first to seven points, win by two. The serve changes after the first point and every two points after that, and players switch ends every six points. The set goes in the books 7-6.","watch":["Points in a tiebreak are counted 1, 2, 3 — not 15, 30, 40."],"kw":"tie-break tiebreaker 7-6 extra","rx":"tie-?break"},{"id":"final-set","sec":"sets","title":"Deciding-set tiebreak","sum":"At all four Grand Slams, a deciding set that reaches 6-6 is settled by a first-to-10 tiebreak, win by two. That ended the marathon final sets like Isner-Mahut's 70-68 at Wimbledon in 2010.","watch":["Most tour events play an ordinary seven-point tiebreak in the final set."],"kw":"fifth set third set super tiebreak 10-point match tiebreak final set","rx":"(super|match|10-point) tie-?break"},{"id":"best-of","sec":"sets","title":"Best of three or five","sum":"Men play best of five sets at the Grand Slams. Nearly everything else — women at the Slams and almost every tour match — is best of three.","watch":[],"kw":"sets match length grand slam"},{"id":"doubles","sec":"score","title":"Doubles scoring","sum":"Tour doubles plays no-ad: at deuce, the next point wins the game, and the receiving team picks who returns it. A third set is replaced by a first-to-10 match tiebreak.","watch":["Grand Slam doubles plays regular advantage sets."],"kw":"no-ad doubles match tiebreak"},{"id":"faults","sec":"serve","title":"Faults & double faults","sum":"A server gets two tries to land the ball in the box diagonally across the net. Miss both and it's a double fault — the point goes to the receiver. Stepping on the baseline before contact is a foot fault.","watch":[],"kw":"double fault foot fault second serve","rx":"double fault|foot fault"},{"id":"let","sec":"serve","title":"Lets","sum":"A serve that clips the net and still lands in is a let and is replayed, as many times as it happens. A point can also be replayed when something interrupts it, like a ball rolling onto the court.","watch":[],"kw":"net cord replay","rx":"\\blet\\b"},{"id":"line-calls","sec":"calls","title":"Line calls & challenges","sum":"Most pro courts now call the lines electronically, so there are no line judges and no challenges — the call is final. Where line judges are still used, players get three wrong challenges per set, plus one more in a tiebreak.","watch":["On clay, the umpire can climb down and check the mark the ball left."],"kw":"hawk-eye hawkeye out electronic line calling replay overrule","rx":"challenge|hawk-?eye|overrule"},{"id":"serve-clock","sec":"calls","title":"Serve clock","sum":"The server has 25 seconds between points. The first violation is a warning; after that, each one costs the server a first serve.","watch":["The receiver has to play to the server's pace too — stalling can cost them a point."],"kw":"shot clock time 25 seconds","rx":"time violation"},{"id":"code","sec":"calls","title":"Code violations","sum":"Racket abuse, coaching outside the rules, swearing and the like are code violations. The penalties step up: a warning, then a point, then a game, then the umpire can default the player.","watch":[],"kw":"warning point penalty default racket","rx":"code violation|point penalty"},{"id":"retire","sec":"calls","title":"Retirements & walkovers","sum":"A player who stops mid-match retires and the opponent advances. One who can't take the court at all gives a walkover. A medical timeout gives a player three minutes of treatment.","watch":[],"kw":"injury ret wo medical timeout","rx":"retire|walkover|medical time"}]},"golf":{"name":"Golf rules","sections":[{"id":"fmt","num":"Format","title":"Format & scoring","blurb":"Stroke play, par and the leaderboard."},{"id":"cut","num":"Cut","title":"The cut","blurb":"Who plays the weekend."},{"id":"end","num":"Playoff","title":"Ties & playoffs","blurb":"How a tie for the lead is broken."},{"id":"pen","num":"Pen","title":"Penalties","blurb":"Water, out of bounds, unplayable lies and the scorecard."},{"id":"wx","num":"Wx","title":"Weather & delays","blurb":"Suspended play and Monday finishes."}],"rules":[{"id":"stroke-play","sec":"fmt","title":"Stroke play & par","sum":"Most tournaments are four rounds of 18 holes, and the lowest total wins. Scores are shown against par: −8 means eight under, E means even.","watch":["Birdie is one under par on a hole, eagle two under, bogey one over."],"kw":"par birdie bogey eagle under over even"},{"id":"ties-board","sec":"fmt","title":"Ties on the leaderboard","sum":"Players with the same score share a position — T4 means tied for fourth. Their prize money for those places is pooled and split evenly.","watch":["Only a tie for first goes to a playoff."],"kw":"t2 tied position money"},{"id":"match-play","sec":"fmt","title":"Match play","sum":"Match play is hole by hole: win a hole and you go 1 up. A match ends when one side leads by more holes than are left — 3 and 2 means three up with two to play. A tied hole is halved.","watch":["Opponents can concede a putt, a hole or the match.","It's the format of the Ryder Cup and Presidents Cup."],"kw":"ryder cup up halved concede all square"},{"id":"cut","sec":"cut","title":"The cut","sum":"After two rounds, the field is trimmed and only the top of the leaderboard plays the weekend. On the PGA Tour it's the top 65 and ties; players who miss it go home without a paycheck.","watch":["Majors set their own: the Masters keeps the top 50 and ties, the U.S. Open the top 60, the PGA Championship and The Open the top 70.","Some events — smaller fields and the FedEx Cup playoffs — have no cut at all."],"kw":"weekend missed cut mc cut line 36 holes","rx":"missed (the )?cut|cut line"},{"id":"playoff","sec":"end","title":"Playoffs","sum":"When players tie for the lead after 72 holes, they go back out until one wins. Most PGA Tour events play sudden death: the first player to win a hole outright takes the title.","watch":["Ties for every other place stand — there's no playoff for second."],"kw":"sudden death tie extra holes","rx":"playoff"},{"id":"major-playoffs","sec":"end","title":"Playoffs at the majors","sum":"Each major breaks a tie its own way. The Masters goes straight to sudden death. The PGA Championship plays three holes and adds them up, the U.S. Open two, and The Open four. Still tied after that, it's sudden death.","watch":["The Open has used three holes in some recent years, depending on the course.","The Players Championship also uses a three-hole aggregate."],"kw":"masters us open pga championship the open aggregate"},{"id":"water","sec":"pen","title":"Penalty areas","sum":"A ball in water or another marked penalty area costs one stroke. The player can drop behind it on a line with the hole, or — for red-staked areas — within two club-lengths of where it crossed in.","watch":["Yellow stakes allow the drop back on the line; red stakes add the sideways option."],"kw":"water hazard drop penalty stroke red yellow stakes","rx":"penalty area|water|hazard"},{"id":"ob","sec":"pen","title":"Out of bounds & lost balls","sum":"A ball out of bounds or lost after three minutes of searching costs stroke and distance: one penalty stroke, and the player hits again from where they last played.","watch":["That's why players hit a provisional ball when they aren't sure the first one is findable."],"kw":"ob white stakes provisional lost ball","rx":"out of bounds|lost ball|provisional"},{"id":"unplayable","sec":"pen","title":"Unplayable lies","sum":"A player can declare their ball unplayable anywhere outside a penalty area. It costs one stroke, then they drop within two club-lengths, back on a line, or replay from the last spot.","watch":[],"kw":"unplayable drop bush tree","rx":"unplayable"},{"id":"scorecard","sec":"pen","title":"Signing the scorecard","sum":"Players sign for their own scores after every round. Sign for a lower score on a hole than they actually made and they're disqualified; sign for a higher one and the higher score stands.","watch":[],"kw":"dq disqualified wrong scorecard","rx":"disqualif|scorecard"},{"id":"weather","sec":"wx","title":"Weather delays","sum":"When the horn blows for lightning, everyone stops at once. For other suspensions players may finish the hole they're on. Play picks up exactly where it stopped, which can push the finish to Monday.","watch":["If weather wipes out too much, a tournament can be shortened to 54 holes."],"kw":"lightning horn suspended monday finish darkness","rx":"suspend|weather delay|darkness"}]},"f1":{"name":"Formula 1 rules","sections":[{"id":"wknd","num":"Wknd","title":"The weekend","blurb":"Qualifying, sprints and how the grid is set."},{"id":"race","num":"Race","title":"The race","blurb":"Distance, the time limit, tyres and overtaking."},{"id":"flags","num":"Flags","title":"Flags & safety cars","blurb":"Safety car, virtual safety car, red flags and the flags drivers see."},{"id":"pen","num":"Pen","title":"Penalties","blurb":"Track limits, time penalties and grid drops."},{"id":"pts","num":"Pts","title":"Points & the title","blurb":"Who scores, shortened races and title tiebreaks."}],"rules":[{"id":"qualifying","sec":"wknd","title":"Qualifying","sum":"Qualifying sets the grid in three knockout sessions. With 22 cars in 2026, the six slowest are out after Q1 (18 minutes) and six more after Q2 (15 minutes). The last 10 fight for pole in Q3 (12 minutes).","watch":["Cars go into parc fermé after qualifying — teams can't change the setup for the race."],"kw":"pole q1 q2 q3 grid knockout","rx":"\\bQ[123]\\b|qualifying|pole"},{"id":"sprint","sec":"wknd","title":"Sprint weekends","sum":"Six weekends add a short Saturday race of about 100 km with its own qualifying. The top eight score, from 8 points for the win down to 1.","watch":[],"kw":"sprint shootout saturday","rx":"sprint"},{"id":"distance","sec":"race","title":"Race distance & time limit","sum":"A grand prix runs the fewest laps that cover 305 km (Monaco is shorter). It can't go past two hours of racing, and with red-flag stoppages the whole thing has to finish within three hours.","watch":["If the clock runs out first, the race ends at the end of that lap."],"kw":"laps length two hours time limit"},{"id":"tyres","sec":"race","title":"Tyres & pit stops","sum":"In a dry race every driver has to use at least two different dry compounds, which means at least one pit stop. The rule falls away once intermediates or wets are used.","watch":["Soft is red, medium yellow, hard white; intermediates are green and full wets blue."],"kw":"compound soft medium hard pit stop undercut","rx":"pit stop|pits|compound|tyre"},{"id":"overtake","sec":"race","title":"Overtake Mode","sum":"In 2026 DRS is gone. A driver within one second of the car ahead at the detection point gets extra electrical power to attack. Every car also flattens its wings on marked straights to cut drag.","watch":[],"kw":"drs overtake mode boost active aero straight mode","rx":"overtake mode|\\bDRS\\b"},{"id":"safety-car","sec":"flags","title":"Safety car & VSC","sum":"After a crash or debris, the safety car leads the field around and no one can pass. Under a virtual safety car there's no car on track — everyone slows to a set pace and the gaps hold.","watch":["A stop under either one costs less time, so teams often pit then.","A race can finish behind the safety car."],"kw":"sc vsc yellow neutralized","rx":"safety car|\\bVSC\\b"},{"id":"red-flag","sec":"flags","title":"Red flag","sum":"A red flag stops the race. Cars come into the pit lane, teams can change tyres for free, and the race restarts when the track is clear. The two-hour clock stops; the three-hour window doesn't.","watch":[],"kw":"stopped suspended restart","rx":"red flag"},{"id":"flags","sec":"flags","title":"Flags","sum":"Yellow: danger, slow down, no passing. Blue: a faster car is about to lap you, let it by. Black-and-white: a warning for driving. Black: disqualified. Chequered: the race is over.","watch":[],"kw":"yellow blue black chequered checkered","rx":"blue flag|yellow flag|black and white flag|black flag"},{"id":"track-limits","sec":"pen","title":"Track limits","sum":"A car has to keep at least part of a wheel on the track. In qualifying, a lap that breaks the limit is deleted. In the race, a driver gets three strikes and a black-and-white flag; the next one is a 5-second penalty.","watch":[],"kw":"white line lap deleted","rx":"track limits|lap (time )?deleted"},{"id":"penalties","sec":"pen","title":"Penalties","sum":"The stewards hand out 5- or 10-second penalties (served at a pit stop or added at the end), drive-throughs and 10-second stop-and-gos. Using too many engine parts costs places on the grid.","watch":["Twelve penalty points on a superlicence within 12 months means a one-race ban."],"kw":"stewards time penalty drive through stop go grid penalty","rx":"penalty|drive-through|stop.?go|stewards"},{"id":"points","sec":"pts","title":"Points","sum":"The top ten score 25, 18, 15, 12, 10, 8, 6, 4, 2 and 1. The bonus point for fastest lap was dropped in 2025.","watch":["Teams' points are both their drivers' added together."],"kw":"championship standings score"},{"id":"short-race","sec":"pts","title":"Shortened races","sum":"If a race is stopped early, points depend on how much was run. Under two green-flag laps, no one scores. Under 25% of the distance, only the top five score; under 50%, the top nine; under 75%, the top ten on a reduced scale. Past 75%, full points.","watch":[],"kw":"half points rain red flag reduced"},{"id":"tiebreak","sec":"pts","title":"Championship ties","sum":"If two drivers finish level on points, the one with more wins takes it. Still level, it's most second places, then thirds, and so on.","watch":[],"kw":"title tie countback"}]}},"sportBook":{"mlb":"mlb","nfl":"football","cfb":"football","nba":"basketball","wnba":"basketball","nhl":"hockey","mls":"soccer","nwsl":"soccer","cbb":"basketball","tennis":"tennis","golf":"golf","f1":"f1"},"links":{"mlb":{"label":"MLB Official Rules","url":"https://www.mlb.com/glossary/rules"},"nfl":{"label":"NFL Rulebook","url":"https://operations.nfl.com/the-rules/"},"cfb":{"label":"NCAA Football Rules","url":null},"nba":{"label":"NBA Rulebook","url":"https://official.nba.com/rulebook/"},"wnba":{"label":"WNBA.com","url":"https://www.wnba.com/"},"nhl":{"label":"NHL Rulebook","url":"https://www.nhl.com/info/video-rulebook"},"mls":{"label":"IFAB Laws of the Game","url":"https://www.theifab.com/laws/latest/"},"nwsl":{"label":"IFAB Laws of the Game","url":"https://www.theifab.com/laws/latest/"},"cbb":{"label":"NCAA Basketball Rules","url":null},"tennis":{"label":"ITF Rules of Tennis","url":"https://www.itftennis.com/en/about-us/governance/rules-and-regulations/"},"golf":{"label":"Rules of Golf","url":null},"f1":{"label":"FIA F1 Regulations","url":"https://www.fia.com/regulation/category/110"}},"names":{"mlb":"MLB","nfl":"NFL","cfb":"College football","nba":"NBA","wnba":"WNBA","nhl":"NHL","mls":"MLS","nwsl":"NWSL","cbb":"College basketball","tennis":"Tennis","golf":"Golf","f1":"F1"}};

var _RB_BOOK_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/></svg>';
var _IS_SEARCH_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
var _RB_BACK_ICON = '<svg width="9" height="14" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="7 1 1 6.5 7 12"/></svg>';

function _rbSportKey(sport) {
  sport = String(sport || 'mlb').toLowerCase();
  return window.INNINGS_RULES.sportBook[sport] ? sport : 'mlb';
}
function _rbBookKey(sport) { return window.INNINGS_RULES.sportBook[_rbSportKey(sport)]; }
function _rbBook(sport) { return window.INNINGS_RULES.books[_rbBookKey(sport)]; }
function _rbRules(sport) {
  var s = _rbSportKey(sport);
  return _rbBook(s).rules.filter(function (r) { return !r.only || r.only.indexOf(s) !== -1; });
}
function _rbFind(sport, id) { return _rbRules(sport).filter(function (r) { return r.id === id; })[0] || null; }
function _rbSection(sport, secId) { return _rbBook(sport).sections.filter(function (x) { return x.id === secId; })[0] || null; }
function _rbSportName(sport) { return window.INNINGS_RULES.names[_rbSportKey(sport)] || String(sport).toUpperCase(); }
var _rbRxCache = {};
function _rbRx(r) {
  if (!r || !r.rx) return null;
  if (!(r.rx in _rbRxCache)) { try { _rbRxCache[r.rx] = new RegExp(r.rx, 'i'); } catch (e) { _rbRxCache[r.rx] = null; } }
  return _rbRxCache[r.rx];
}
function _rbMatch(sport, text) {
  if (!text) return null;
  var list = _rbRules(sport);
  for (var i = 0; i < list.length; i++) { var rx = _rbRx(list[i]); if (rx && rx.test(text)) return list[i]; }
  return null;
}
function _rbFirstSentence(t) { var m = String(t || '').match(/^.*?[.!?](\s|$)/); return m ? m[0].trim() : String(t || ''); }

// Chip under a play that names a rule — tap opens the rule. Only on the
// game screen (callers pass the game's sport); stopPropagation keeps it
// from counting toward the row's double-tap reaction.
function _ruleChipHtml(sport, text) {
  var r = _rbMatch(sport, text);
  if (!r) return '';
  return '<button class="rb-chip" data-s="' + _escapeHtml(_rbSportKey(sport)) + '" data-r="' + _escapeHtml(r.id) + '" onclick="event.stopPropagation();openRule(this.dataset.s,this.dataset.r,\'game\')">' +
    _RB_BOOK_ICON + '<span>' + _escapeHtml(r.title) + '</span></button>';
}

// ── Rules tab on the game screen ──
window._rb = { sport: null, q: '', open: {}, forGame: null };
function renderGameRules() {
  var panel = document.getElementById('game-rules-panel');
  if (!panel) return;
  var st = window._rb, g = window._activeBrowseGame;
  var pk = g ? String(g.gamePk) : null;
  if (!st.sport || st.forGame !== pk) { st.sport = _rbSportKey(g && g.sport); st.forGame = pk; st.q = ''; st.open = {}; }
  st.box = 'rb-results';
  var pills = GAMES_SPORTS.map(function (s) {
    var on = s.key === st.sport;
    return '<button class="rb-pill' + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="rbPickSport(\'' + s.key + '\')">' + _escapeHtml(s.name) + '</button>';
  }).join('');
  panel.innerHTML =
    '<div class="rb-pills">' + pills + '</div>' +
    '<label class="rb-search">' + _IS_SEARCH_ICON +
      '<input id="rb-q" autocomplete="off" aria-label="Search the rules" placeholder="Search ' + _escapeHtml(_rbSportName(st.sport)) + ' rules" value="' + _escapeHtml(st.q) + '" oninput="rbSearch(this.value)"></label>' +
    '<div id="rb-results"></div>';
  _rbRenderResults();
}
function rbPickSport(k) { var st = window._rb; st.sport = _rbSportKey(k); st.q = ''; st.open = {}; renderGameRules(); }
function rbSearch(v) { window._rb.q = v; _rbRenderResults(); }
function rbToggleSection(id) { var o = window._rb.open; o[id] = !o[id]; _rbRenderResults(); }
function _rbRuleRowHtml(sport, r, showBook) {
  return '<button class="rb-rule" data-s="' + _escapeHtml(sport) + '" data-r="' + _escapeHtml(r.id) + '" onclick="openRule(this.dataset.s,this.dataset.r,\'game\')">' +
    '<span class="rb-rule-t">' + _escapeHtml(r.title) + (showBook ? ' <em>' + _escapeHtml(_rbSportName(sport)) + '</em>' : '') + '</span>' +
    '<span class="rb-rule-s">' + _escapeHtml(_rbFirstSentence(r.sum)) + '</span></button>';
}
function _rbMatchesQuery(sport, r, q) {
  var sec = _rbSection(sport, r.sec);
  var hay = (r.title + ' ' + r.sum + ' ' + (r.kw || '') + ' ' + (sec ? sec.title : '')).toLowerCase();
  return q.split(/\s+/).every(function (w) { return !w || hay.indexOf(w) !== -1; });
}
function _rbContextRules(sport) {
  var g = window._activeBrowseGame;
  if (!g || _rbSportKey(g.sport) !== sport) return [];
  var sheet = document.getElementById('game-sheet-panel');
  var text = sheet ? (sheet.innerText || sheet.textContent || '') : '';
  if (!text) return [];
  return _rbRules(sport).filter(function (r) { var rx = _rbRx(r); return rx && rx.test(text); }).slice(0, 6);
}
function _rbRenderResults() {
  var box = document.getElementById(window._rb.box || 'rb-results');
  if (!box) return;
  var st = window._rb, sport = st.sport, book = _rbBook(sport), q = (st.q || '').trim().toLowerCase();
  var link = window.INNINGS_RULES.links[sport] || {};
  var html = '';
  if (q) {
    var hits = _rbRules(sport).filter(function (r) { return _rbMatchesQuery(sport, r, q); });
    html += '<div class="rb-eyebrow">' + hits.length + (hits.length === 1 ? ' rule' : ' rules') + '</div>';
    html += hits.length ? '<div class="rb-list">' + hits.map(function (r) { return _rbRuleRowHtml(sport, r); }).join('') + '</div>'
      : '<div class="rb-empty">Nothing in the ' + _escapeHtml(_rbSportName(sport)) + ' rules matches that. Try a simpler word.</div>';
    box.innerHTML = html;
    return;
  }
  var ctx = _rbContextRules(sport);
  if (ctx.length) {
    html += '<div class="rb-eyebrow">Came up in this game</div><div class="rb-ctx">' + ctx.map(function (r) {
      return '<button class="rb-chip rb-chip-ctx" data-s="' + sport + '" data-r="' + _escapeHtml(r.id) + '" onclick="openRule(this.dataset.s,this.dataset.r,\'game\')">' + _escapeHtml(r.title) + '</button>';
    }).join('') + '</div>';
  }
  html += '<div class="rb-bookhead"><span class="rb-eyebrow" style="margin:0">' + _escapeHtml(book.name) + '</span>' +
    (link.url ? '<a href="' + _escapeHtml(link.url) + '" target="_blank" rel="noopener">' + _escapeHtml(link.label) + ' ↗</a>' : '') + '</div>';
  var rules = _rbRules(sport);
  book.sections.forEach(function (sec) {
    var inSec = rules.filter(function (r) { return r.sec === sec.id; });
    if (!inSec.length) return;
    var open = !!st.open[sec.id];
    html += '<div class="rb-sec' + (open ? ' open' : '') + '">' +
      '<button class="rb-sec-hd" aria-expanded="' + open + '" onclick="rbToggleSection(\'' + sec.id + '\')">' +
        '<span class="rb-num">' + _escapeHtml(sec.num) + '</span>' +
        '<span class="rb-sec-txt"><b>' + _escapeHtml(sec.title) + '</b><span>' + _escapeHtml(sec.blurb) + '</span></span>' +
        '<svg class="rb-chev" width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><polyline points="1 1 7 6.5 1 12"/></svg>' +
      '</button>' +
      (open ? '<div class="rb-list">' + inSec.map(function (r) { return _rbRuleRowHtml(sport, r); }).join('') + '</div>' : '') +
    '</div>';
  });
  html += '<div class="rb-foot">Summaries written for Innings. The official rulebook is the final word.</div>';
  box.innerHTML = html;
}

// ── Rules tab on a tennis, golf or F1 event (v7.92.0) — same book, search
// and sections as the game screen, drawn into the event's own body. It's
// drawn once per visit so a poll doesn't wipe what you're typing.
function renderFieldRules(sport) {
  var body = document.getElementById('fs-ev-body');
  if (!body) return;
  var st = window._rb, key = 'fs:' + sport;
  if (st.forGame !== key) { st.sport = _rbSportKey(sport); st.forGame = key; st.q = ''; st.open = {}; }
  st.box = 'fs-rb-results';
  body.innerHTML = '<div class="fs-rules">' +
    '<label class="rb-search">' + _IS_SEARCH_ICON +
      '<input id="fs-rb-q" autocomplete="off" aria-label="Search the rules" placeholder="Search ' + _escapeHtml(_rbSportName(st.sport)) + ' rules" value="' + _escapeHtml(st.q) + '" oninput="rbSearch(this.value)"></label>' +
    '<div id="fs-rb-results"></div></div>';
  _rbRenderResults();
}

// ── Rule detail (full-screen overlay; works from the game screen or search) ──
window._rbOpen = null;
function openRule(sport, id, from) {
  sport = _rbSportKey(sport);
  var r = _rbFind(sport, id);
  if (!r) return;
  window._rbOpen = { sport: sport, id: id, from: from || null };
  var ov = document.getElementById('rule-overlay');
  var body = document.getElementById('rule-body');
  if (!ov || !body) return;
  var sec = _rbSection(sport, r.sec);
  var link = window.INNINGS_RULES.links[sport] || {};
  var note = r.notes && r.notes[sport];
  var mems = _rbMemoriesFor(sport, r);
  var gameOpen = from === 'game' && window._activeBrowseGame && document.getElementById('screen-game') && document.getElementById('screen-game').classList.contains('active');
  body.innerHTML =
    '<div class="rb-eyebrow" style="margin:0 0 6px">' + _escapeHtml(_rbSportName(sport) + (sec ? ' · ' + sec.title : '')) + '</div>' +
    '<h1 class="rb-h1">' + _escapeHtml(r.title) + '</h1>' +
    '<div class="rb-card"><div class="rb-eyebrow" style="margin:0 0 8px">In plain English</div><p>' + _escapeHtml(r.sum) + '</p></div>' +
    (note ? '<div class="rb-card rb-note"><div class="rb-eyebrow" style="margin:0 0 6px">' + _escapeHtml(_rbSportName(sport)) + '</div><p>' + _escapeHtml(note) + '</p></div>' : '') +
    (r.watch && r.watch.length ? '<div><div class="rb-eyebrow">Watch for</div><ul class="rb-watch">' + r.watch.map(function (w) { return '<li>' + _escapeHtml(w) + '</li>'; }).join('') + '</ul></div>' : '') +
    (mems.length ? '<div><div class="rb-eyebrow">In your memories</div><div class="rb-list">' + mems.map(function (m) {
      return '<button class="rb-rule" data-id="' + _escapeHtml(m._id) + '" onclick="closeRule();openMemory(this.dataset.id)"><span class="rb-rule-t">' + _escapeHtml(m.name || 'Memory') + '</span>' +
        '<span class="rb-rule-s">' + _escapeHtml(m.date ? _formatMomentDate(m.date) : '') + '</span></button>';
    }).join('') + '</div></div>' : '') +
    '<div class="rb-actions">' +
      (gameOpen ? '<button class="rb-btn rb-btn-pri" onclick="ruleAskChat()">Ask the chat</button>' : '') +
      (link.url ? '<a class="rb-btn" href="' + _escapeHtml(link.url) + '" target="_blank" rel="noopener">' + _escapeHtml(link.label) + ' ↗</a>' : '') +
    '</div>' +
    '<div class="rb-foot">Summary written for Innings. The official rulebook is the final word.</div>';
  ov.style.display = 'flex';
  body.scrollTop = 0;
}
function closeRule() {
  var ov = document.getElementById('rule-overlay');
  if (ov) ov.style.display = 'none';
  window._rbOpen = null;
}
function ruleAskChat() {
  var o = window._rbOpen;
  var r = o && _rbFind(o.sport, o.id);
  closeRule();
  if (typeof gameDetailTab === 'function') gameDetailTab('chat');
  var f = document.getElementById('game-chat-field');
  if (f && r) { f.value = 'Rules question — ' + r.title.toLowerCase() + ': '; f.focus(); }
}
function _rbMemoriesFor(sport, r) {
  var rx = _rbRx(r);
  if (!rx) return [];
  var bookKey = _rbBookKey(sport);
  return (window._moments || []).filter(function (m) {
    if (!m || !m.boxScore) return false;
    if (_rbBookKey(m.boxScore.sport || 'mlb') !== bookKey) return false;
    var t;
    try { t = JSON.stringify(m.boxScore) + ' ' + (m.highlight || ''); } catch (e) { return false; }
    return rx.test(t);
  }).slice(0, 5);
}

// ══ GLOBAL SEARCH — players, teams and rules across every sport ══
window._is = { q: '', filter: 'all', teams: {}, players: [], loading: false, err: false, token: 0, timer: null, mem: null };
function openInningsSearch() {
  var ov = document.getElementById('isearch-overlay');
  if (!ov) return;
  window._is.mem = null; // rebuilt lazily from the current memories
  ov.style.display = 'flex';
  var inp = document.getElementById('is-q');
  if (inp) { inp.value = window._is.q; setTimeout(function () { inp.focus(); }, 30); }
  _isLoadTeams();
  _isRender();
}
function closeInningsSearch() {
  var ov = document.getElementById('isearch-overlay');
  if (ov) ov.style.display = 'none';
}
function isFilter(k) { window._is.filter = k; _isRender(); }
function isInput(v) {
  var s = window._is;
  s.q = v;
  clearTimeout(s.timer);
  // Drop the last query's players right away so they don't sit under a
  // new search while it loads.
  s.token++;
  s.players = [];
  s.loading = v.trim().length >= 2;
  s.timer = setTimeout(function () { _isFetchPlayers(v.trim()); }, 300);
  _isRender();
}
function _isLoadTeams() {
  var s = window._is;
  GAMES_SPORTS.forEach(function (sp) {
    if (s.teams[sp.key]) return;
    s.teams[sp.key] = [];
    fetch(_tpTeamsUrl(sp.key)).then(function (r) { return r.json(); }).then(function (d) {
      s.teams[sp.key] = (d && d.teams) || [];
      _isRender();
    }).catch(function (err) { console.error('[search:teams:' + sp.key + ']', err); s.teams[sp.key] = null; });
  });
}
// Both providers at once: MLB's own Stats API for baseball, ESPN's
// (unofficial, best-effort) search for everything else.
function _isPlayerSearch(q) {
  var enc = encodeURIComponent(q);
  var get = function (url) {
    return fetch(url).then(function (r) { return r.json(); }).catch(function (err) { console.error('[search:players] ' + url, err); return { players: [], failed: true }; });
  };
  // v7.78.2: all=1 — every MLB player ever, retired included (MLB's own name search only covers recent players)
  return Promise.all([get('/api/mlb?mode=search&all=1&q=' + enc), get('/api/espn?mode=search&q=' + enc)]).then(function (res) {
    var mlb = (res[0] && res[0].players) || [];
    var other = ((res[1] && res[1].players) || []).filter(function (p) { return p.league !== 'mlb'; });
    return { players: _isRankPlayers(mlb.concat(other), q), failed: !!(res[0].failed && res[1].failed) };
  });
}
function _isRankPlayers(list, q) {
  q = q.toLowerCase();
  var seen = {};
  return list.filter(function (p) {
    if (!p || !p.name) return false;
    var k = p.league + ':' + (p.id || p.name);
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  }).map(function (p, i) {
    var n = p.name.toLowerCase(), last = n.split(' ').slice(-1)[0];
    var score = n === q ? 0 : (n.indexOf(q) === 0 ? 1 : (last.indexOf(q) === 0 ? 2 : 3));
    return { p: p, s: score, i: i };
  }).sort(function (a, b) { return a.s - b.s || a.i - b.i; }).map(function (x) { return x.p; });
}
function _isFetchPlayers(q) {
  var s = window._is, tok = ++s.token;
  if (q.length < 2) { s.players = []; s.loading = false; s.err = false; _isRender(); return; }
  s.loading = true;
  _isRender();
  _isPlayerSearch(q).then(function (r) {
    if (tok !== s.token) return;
    s.players = r.players; s.err = r.failed; s.loading = false;
    _isRender();
  });
}
function _isMemIndex() {
  var s = window._is;
  if (s.mem) return s.mem;
  s.mem = (window._moments || []).map(function (m) {
    var t = '';
    try { t = (JSON.stringify(m.boxScore || {}) + ' ' + (m.highlight || '') + ' ' + JSON.stringify(m.players || [])).toLowerCase(); } catch (e) {}
    var bs = m.boxScore || {};
    return { id: m._id, text: t, teams: ((bs.home || '') + '|' + (bs.away || '')).toLowerCase(), pids: (m.players || []).map(function (p) { return p && p.league + ':' + p.id; }) };
  });
  return s.mem;
}
function _isTeamMemCount(name) {
  var n = String(name || '').toLowerCase();
  if (!n) return 0;
  return _isMemIndex().filter(function (m) { return m.teams.indexOf(n) !== -1; }).length;
}
function _isPlayerMemCount(p) {
  var n = String(p.name || '').toLowerCase(), key = p.league + ':' + p.id;
  return _isMemIndex().filter(function (m) { return m.pids.indexOf(key) !== -1 || (n && m.text.indexOf(n) !== -1); }).length;
}
function _isMemBadge(n) { return n ? '<span class="is-badge">' + (n === 1 ? 'In 1 memory' : 'In ' + n + ' memories') + '</span>' : ''; }
function _isTeamHits(q) {
  var s = window._is, out = [];
  q = q.toLowerCase();
  GAMES_SPORTS.forEach(function (sp) {
    (s.teams[sp.key] || []).forEach(function (t) {
      var n = String(t.name || '').toLowerCase();
      if (!n) return;
      var at = n.indexOf(q);
      if (at === -1) return;
      out.push({ league: sp.key, id: t.id, name: t.name, s: (at === 0 || n.charAt(at - 1) === ' ') ? 0 : 1 });
    });
  });
  // Pro leagues ahead of the 700-odd college teams on a tie.
  return out.sort(function (a, b) { return a.s - b.s || (a.league === 'cfb') - (b.league === 'cfb'); });
}
function _isRuleHits(q) {
  var out = [], seen = {};
  q = q.toLowerCase();
  // NFL/college and NBA/WNBA share a book — each rule is listed once,
  // under the first sport it applies to (so college-only targeting
  // still shows, under college football).
  // v7.92.0: tennis, golf and F1 have books too
  GAMES_SPORTS.map(function (sp) { return sp.key; }).concat(['tennis', 'golf', 'f1']).forEach(function (k) {
    var bk = _rbBookKey(k);
    _rbRules(k).forEach(function (r) {
      if (seen[bk + ':' + r.id] || !_rbMatchesQuery(k, r, q)) return;
      seen[bk + ':' + r.id] = true;
      out.push({ sport: k, r: r });
    });
  });
  return out;
}
function _isRender() {
  var s = window._is;
  var tabs = document.getElementById('is-tabs');
  if (tabs) {
    tabs.innerHTML = [['all', 'All'], ['players', 'Players'], ['teams', 'Teams'], ['rules', 'Rules']].map(function (t) {
      var on = s.filter === t[0];
      return '<button class="rb-pill' + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="isFilter(\'' + t[0] + '\')">' + t[1] + '</button>';
    }).join('');
  }
  var box = document.getElementById('is-results');
  if (!box) return;
  var q = (s.q || '').trim();
  if (q.length < 2) {
    box.innerHTML = '<div class="rb-empty" style="padding-top:40px">Search players, teams and rules across every sport.</div>';
    return;
  }
  var all = s.filter === 'all', cap = all ? 5 : 40, html = '';
  if (all && typeof _msSearch === 'function') {
    var mine = _msSearch(q, 'all').memories.slice(0, 4);
    if (mine.length) html += '<div class="rb-eyebrow">Your memories</div><div class="ms-list">' + mine.map(function (x) {
      return _msRowHtml(x, q.toLowerCase()).replace('onclick="openMemory(', 'onclick="closeInningsSearch();openMemory(');
    }).join('') + '</div>';
  }
  if (all || s.filter === 'teams') {
    var teams = _isTeamHits(q).slice(0, cap);
    if (teams.length || !all) {
      html += '<div class="rb-eyebrow">Teams</div>';
      html += teams.length ? '<div class="rb-list">' + teams.map(function (t) {
        return '<button class="is-row" data-l="' + t.league + '" data-id="' + _escapeHtml(String(t.id == null ? '' : t.id)) + '" data-n="' + _escapeHtml(t.name) + '" onclick="isOpenTeam(this.dataset.l,this.dataset.id,this.dataset.n)">' +
          '<span class="is-av">' + _escapeHtml(_initials(t.name)) + '</span>' +
          '<span class="is-txt"><b>' + _escapeHtml(t.name) + '</b><span>' + _escapeHtml(_rbSportName(t.league)) + '</span></span>' + _isMemBadge(_isTeamMemCount(t.name)) + '</button>';
      }).join('') + '</div>' : '<div class="rb-empty">No teams match.</div>';
    }
  }
  if (all || s.filter === 'players') {
    html += '<div class="rb-eyebrow">Players</div>';
    if (s.loading && !s.players.length) html += '<div class="rb-empty">Searching…</div>';
    else if (!s.players.length) html += '<div class="rb-empty">' + (s.err ? 'Player search is unavailable right now.' : 'No players match.') + '</div>';
    else html += '<div class="rb-list">' + s.players.slice(0, cap).map(function (p) {
      var sub = [p.pos, p.active === false ? (p.hof ? 'Hall of Fame' : 'Retired') + (p.first ? ' · ' + p.first + '–' + (p.last || '') : '') : (p.fa ? 'Free agent' : p.team), _rbSportName(p.league)].filter(Boolean).join(' · ');
      return '<button class="is-row" data-n="' + _escapeHtml(p.name) + '" data-id="' + _escapeHtml(String(p.id == null ? '' : p.id)) + '" data-l="' + _escapeHtml(p.league) + '" onclick="openPlayerLinkSheet(this.dataset.n,this.dataset.id||null,this.dataset.l)">' +
        '<span class="is-av">' + _escapeHtml(_initials(p.name)) + '</span>' +
        '<span class="is-txt"><b>' + _escapeHtml(p.name) + '</b><span>' + _escapeHtml(sub) + '</span></span>' + _isMemBadge(_isPlayerMemCount(p)) + '</button>';
    }).join('') + '</div>';
  }
  if (all || s.filter === 'rules') {
    var rules = _isRuleHits(q).slice(0, cap);
    if (rules.length || !all) {
      html += '<div class="rb-eyebrow">Rules</div>';
      html += rules.length ? '<div class="rb-list">' + rules.map(function (x) {
        return '<button class="rb-rule" data-s="' + x.sport + '" data-r="' + _escapeHtml(x.r.id) + '" onclick="openRule(this.dataset.s,this.dataset.r,\'search\')">' +
          '<span class="rb-rule-t">' + _escapeHtml(x.r.title) + ' <em>' + _escapeHtml(_rbBook(x.sport).name) + '</em></span>' +
          '<span class="rb-rule-s">' + _escapeHtml(_rbFirstSentence(x.r.sum)) + '</span></button>';
      }).join('') + '</div>' : '<div class="rb-empty">No rules match.</div>';
    }
  }
  box.innerHTML = html;
}
function isOpenTeam(league, id, name) {
  closeInningsSearch();
  if (typeof _TM_LEAGUES !== 'undefined' && _TM_LEAGUES[league]) { openTeamPage(league, id || null, name); return; }
  // No team page for this league yet — the follow/favorite list is the
  // closest thing, and it's where they'd go next anyway.
  if (typeof openTeamPrefs === 'function') {
    openTeamPrefs(league);
    var el = document.getElementById('tp-search');
    if (el) { el.value = name; el.dispatchEvent(new Event('input', { bubbles: true })); }
  }
}

// ══ TAG A PLAYER in a game memory ══
// "In this game" is read off the players the cheat sheet already
// rendered as tappable names (lineups, box score, leaders) — whatever
// the sport, that's the one list every game screen already has. Anyone
// else comes from the same player search as the global search.
window._pt = { q: '', game: [], results: [], loading: false, token: 0, timer: null };
function _ptGamePlayers() {
  var seen = {}, out = [];
  var root = document.getElementById('game-sheet-panel');
  if (!root) return out;
  root.querySelectorAll('[data-name][data-league]').forEach(function (el) {
    var name = el.getAttribute('data-name');
    if (!name || seen[name]) return;
    seen[name] = true;
    var id = el.getAttribute('data-id');
    out.push({ id: id || null, name: name, pos: null, team: null, league: el.getAttribute('data-league') || null });
  });
  return out;
}
function _ptKey(p) { return (p.league || '') + ':' + (p.id || p.name); }
function _ptSelected() { var d = window._gatt && window._gatt.draft; return (d && d.players) || []; }
function gattOpenPlayerTag() {
  var s = window._pt;
  s.q = ''; s.results = []; s.loading = false;
  s.game = _ptGamePlayers();
  var ov = document.getElementById('ptag-overlay');
  if (!ov) return;
  ov.style.display = 'flex';
  var inp = document.getElementById('pt-q');
  if (inp) inp.value = '';
  _ptRender();
}
function ptClose() {
  var ov = document.getElementById('ptag-overlay');
  if (ov) ov.style.display = 'none';
  _gattRenderPlayers();
}
function ptInput(v) {
  var s = window._pt;
  s.q = v;
  clearTimeout(s.timer);
  var q = v.trim();
  if (q.length >= 2) {
    s.timer = setTimeout(function () {
      var tok = ++s.token;
      s.loading = true; _ptRender();
      _isPlayerSearch(q).then(function (r) { if (tok !== s.token) return; s.results = r.players; s.loading = false; _ptRender(); });
    }, 300);
  } else { s.token++; s.results = []; s.loading = false; }
  _ptRender();
}
function ptToggle(el) {
  var d = window._gatt && window._gatt.draft;
  if (!d) return;
  d.players = d.players || [];
  var p = { id: el.getAttribute('data-id') || null, name: el.getAttribute('data-n'), pos: el.getAttribute('data-pos') || null, team: el.getAttribute('data-team') || null, league: el.getAttribute('data-l') || null };
  var k = _ptKey(p), i = -1;
  d.players.forEach(function (x, j) { if (_ptKey(x) === k) i = j; });
  if (i === -1) d.players.push(p); else d.players.splice(i, 1);
  _ptRender();
}
function _ptRowHtml(p) {
  var on = _ptSelected().some(function (x) { return _ptKey(x) === _ptKey(p); });
  var sub = [p.pos, p.team, p.league ? _rbSportName(p.league) : null].filter(Boolean).join(' · ');
  return '<button class="is-row' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-n="' + _escapeHtml(p.name) + '" data-id="' + _escapeHtml(String(p.id == null ? '' : p.id)) + '" data-l="' + _escapeHtml(p.league || '') + '" data-pos="' + _escapeHtml(p.pos || '') + '" data-team="' + _escapeHtml(p.team || '') + '" onclick="ptToggle(this)">' +
    '<span class="is-av">' + _escapeHtml(_initials(p.name)) + '</span>' +
    '<span class="is-txt"><b>' + _escapeHtml(p.name) + '</b>' + (sub ? '<span>' + _escapeHtml(sub) + '</span>' : '') + '</span>' +
    '<span class="pt-tick" aria-hidden="true">' + (on ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>' : '') + '</span></button>';
}
function _ptRender() {
  var s = window._pt, box = document.getElementById('pt-results');
  if (!box) return;
  var q = s.q.trim().toLowerCase();
  var sel = _ptSelected();
  var html = '';
  if (sel.length) html += '<div class="rb-eyebrow">Tagged</div><div class="rb-list">' + sel.map(_ptRowHtml).join('') + '</div>';
  var selKeys = sel.map(_ptKey);
  var game = s.game.filter(function (p) { return selKeys.indexOf(_ptKey(p)) === -1 && (!q || p.name.toLowerCase().indexOf(q) !== -1); });
  html += '<div class="rb-eyebrow">In this game</div>';
  html += game.length ? '<div class="rb-list">' + game.slice(0, 40).map(_ptRowHtml).join('') + '</div>'
    : '<div class="rb-empty">' + (s.game.length ? 'No one in this game matches.' : 'No lineups on the cheat sheet yet — search below.') + '</div>';
  if (q.length >= 2) {
    var gameKeys = s.game.map(_ptKey).concat(selKeys);
    var more = s.results.filter(function (p) { return gameKeys.indexOf(_ptKey(p)) === -1; });
    html += '<div class="rb-eyebrow">Everyone</div>';
    html += s.loading && !more.length ? '<div class="rb-empty">Searching…</div>'
      : (more.length ? '<div class="rb-list">' + more.slice(0, 20).map(_ptRowHtml).join('') + '</div>' : '<div class="rb-empty">No other players match.</div>');
  } else {
    html += '<div class="rb-empty">Not in this game? Type a name to search every sport.</div>';
  }
  box.innerHTML = html;
}
function _gattRenderPlayers() {
  var box = document.getElementById('gatt-players');
  var cnt = document.getElementById('gatt-pcnt');
  var sel = _ptSelected();
  if (cnt) cnt.textContent = sel.length ? sel.length + ' tagged' : 'Optional';
  if (!box) return;
  box.innerHTML = sel.map(function (p, i) {
    return '<span class="pt-chip">' + _escapeHtml(p.name) + '<button aria-label="Remove ' + _escapeHtml(p.name) + '" onclick="gattRemovePlayer(' + i + ')">×</button></span>';
  }).join('') + '<button class="pt-add" onclick="gattOpenPlayerTag()">+ Tag a player</button>';
}
function gattRemovePlayer(i) {
  var d = window._gatt && window._gatt.draft;
  if (!d || !d.players) return;
  d.players.splice(i, 1);
  _gattRenderPlayers();
}
function _mdPlayersHtml(m) {
  var ps = (m && m.players) || [];
  if (!ps.length) return '';
  return '<div style="font-size:10.5px;font-weight:700;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.1em;margin:12px 0 8px">Players</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px">' + ps.map(function (p) {
      return '<button class="pt-chip pt-chip-link" data-n="' + _escapeHtml(p.name || '') + '" data-id="' + _escapeHtml(String(p.id == null ? '' : p.id)) + '" data-l="' + _escapeHtml(p.league || '') + '" onclick="openPlayerLinkSheet(this.dataset.n,this.dataset.id||null,this.dataset.l)">' + _escapeHtml(p.name || '') + '</button>';
    }).join('') + '</div>';
}
