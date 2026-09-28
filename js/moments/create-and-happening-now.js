// CREATE MOMENT FUNCTIONS — standalone, no Firebase dependency
// ── HAPPENING NOW: venue detection ──
// Deliberately a hardcoded, static table rather than a geocoding API call —
// there's no live service wired up for that, and guessing at one would mean
// silently failing in a way nobody could diagnose. This only recognizes
// places explicitly taught to it. Athletics/Rays entries reflect their 2026
// home parks specifically and will need updating if that changes again.
var MLB_BALLPARKS = [
  { name: 'Angel Stadium', lat: 33.8003, lng: -117.8827, team: 'Angels' },
  { name: 'Chase Field', lat: 33.4455, lng: -112.0667, team: 'Diamondbacks' },
  { name: 'Truist Park', lat: 33.8908, lng: -84.4678, team: 'Braves' },
  { name: 'Oriole Park at Camden Yards', lat: 39.2839, lng: -76.6218, team: 'Orioles' },
  { name: 'Fenway Park', lat: 42.3467, lng: -71.0972, team: 'Red Sox' },
  { name: 'Wrigley Field', lat: 41.9484, lng: -87.6553, team: 'Cubs' },
  { name: 'Guaranteed Rate Field', lat: 41.8299, lng: -87.6338, team: 'White Sox' },
  { name: 'Great American Ball Park', lat: 39.0979, lng: -84.5082, team: 'Reds' },
  { name: 'Progressive Field', lat: 41.4962, lng: -81.6852, team: 'Guardians' },
  { name: 'Coors Field', lat: 39.7559, lng: -104.9942, team: 'Rockies' },
  { name: 'Comerica Park', lat: 42.3390, lng: -83.0485, team: 'Tigers' },
  { name: 'Minute Maid Park', lat: 29.7573, lng: -95.3555, team: 'Astros' },
  { name: 'Kauffman Stadium', lat: 39.0517, lng: -94.4803, team: 'Royals' },
  { name: 'Dodger Stadium', lat: 34.0739, lng: -118.2400, team: 'Dodgers' },
  { name: 'loanDepot park', lat: 25.7781, lng: -80.2196, team: 'Marlins' },
  { name: 'American Family Field', lat: 43.0280, lng: -87.9712, team: 'Brewers' },
  { name: 'Target Field', lat: 44.9817, lng: -93.2776, team: 'Twins' },
  { name: 'Citi Field', lat: 40.7571, lng: -73.8458, team: 'Mets' },
  { name: 'Yankee Stadium', lat: 40.8296, lng: -73.9262, team: 'Yankees' },
  { name: 'Sutter Health Park', lat: 38.5805, lng: -121.5127, team: 'Athletics' },
  { name: 'Citizens Bank Park', lat: 39.9061, lng: -75.1665, team: 'Phillies' },
  { name: 'PNC Park', lat: 40.4468, lng: -80.0057, team: 'Pirates' },
  { name: 'Petco Park', lat: 32.7073, lng: -117.1566, team: 'Padres' },
  { name: 'Oracle Park', lat: 37.7786, lng: -122.3893, team: 'Giants' },
  { name: 'T-Mobile Park', lat: 47.5914, lng: -122.3325, team: 'Mariners' },
  { name: 'Busch Stadium', lat: 38.6226, lng: -90.1928, team: 'Cardinals' },
  { name: 'Tropicana Field', lat: 27.7683, lng: -82.6534, team: 'Rays' },
  { name: 'Globe Life Field', lat: 32.7473, lng: -97.0842, team: 'Rangers' },
  { name: 'Rogers Centre', lat: 43.6414, lng: -79.3894, team: 'Blue Jays' },
  { name: 'Nationals Park', lat: 38.8730, lng: -77.0074, team: 'Nationals' }
];
var FESTIVAL_VENUES = [
  { name: 'Golden Gate Park', lat: 37.7694, lng: -122.4862, radiusM: 2200, screen: 'osl-group', label: 'Outside Lands' }
];

// Confidence note, read before trusting this table: NFL/NBA/NHL are stable,
// decades-old franchises with fixed venues — high confidence. WNBA and MLS
// are current as of a 2026 check (Utah Mammoth, not Arizona Coyotes;
// Portland Fire and Toronto Tempo included). NWSL specifically has the
// least verification here — it's the newest, fastest-changing league in
// this list, and worth spot-checking before relying on it. `league` below
// is the routing key: 'nhl' hits the official NHL API, everything else
// hits the shared ESPN endpoint with that value as the league param.
var OTHER_SPORTS_VENUES = [
  // NFL
  { name: 'State Farm Stadium', lat: 33.5276, lng: -112.2626, sport: 'football', league: 'nfl', team: 'Cardinals' },
  { name: 'Mercedes-Benz Stadium', lat: 33.7554, lng: -84.4008, sport: 'football', league: 'nfl', team: 'Falcons' },
  { name: 'M&T Bank Stadium', lat: 39.2780, lng: -76.6227, sport: 'football', league: 'nfl', team: 'Ravens' },
  { name: 'Highmark Stadium', lat: 42.7738, lng: -78.7870, sport: 'football', league: 'nfl', team: 'Bills' },
  { name: 'Bank of America Stadium', lat: 35.2258, lng: -80.8528, sport: 'football', league: 'nfl', team: 'Panthers' },
  { name: 'Soldier Field', lat: 41.8623, lng: -87.6167, sport: 'football', league: 'nfl', team: 'Bears' },
  { name: 'Paycor Stadium', lat: 39.0954, lng: -84.5160, sport: 'football', league: 'nfl', team: 'Bengals' },
  { name: 'Huntington Bank Field', lat: 41.5061, lng: -81.6995, sport: 'football', league: 'nfl', team: 'Browns' },
  { name: 'AT&T Stadium', lat: 32.7473, lng: -97.0945, sport: 'football', league: 'nfl', team: 'Cowboys' },
  { name: 'Empower Field at Mile High', lat: 39.7439, lng: -105.0201, sport: 'football', league: 'nfl', team: 'Broncos' },
  { name: 'Ford Field', lat: 42.3400, lng: -83.0456, sport: 'football', league: 'nfl', team: 'Lions' },
  { name: 'Lambeau Field', lat: 44.5013, lng: -88.0622, sport: 'football', league: 'nfl', team: 'Packers' },
  { name: 'NRG Stadium', lat: 29.6847, lng: -95.4107, sport: 'football', league: 'nfl', team: 'Texans' },
  { name: 'Lucas Oil Stadium', lat: 39.7601, lng: -86.1639, sport: 'football', league: 'nfl', team: 'Colts' },
  { name: 'EverBank Stadium', lat: 30.3239, lng: -81.6373, sport: 'football', league: 'nfl', team: 'Jaguars' },
  { name: 'Arrowhead Stadium', lat: 39.0489, lng: -94.4839, sport: 'football', league: 'nfl', team: 'Chiefs' },
  { name: 'Allegiant Stadium', lat: 36.0909, lng: -115.1833, sport: 'football', league: 'nfl', team: 'Raiders' },
  { name: 'SoFi Stadium', lat: 33.9535, lng: -118.3392, sport: 'football', league: 'nfl', team: 'Chargers' },
  { name: 'SoFi Stadium', lat: 33.9535, lng: -118.3392, sport: 'football', league: 'nfl', team: 'Rams' },
  { name: 'Hard Rock Stadium', lat: 25.9580, lng: -80.2389, sport: 'football', league: 'nfl', team: 'Dolphins' },
  { name: 'U.S. Bank Stadium', lat: 44.9737, lng: -93.2577, sport: 'football', league: 'nfl', team: 'Vikings' },
  { name: 'Gillette Stadium', lat: 42.0909, lng: -71.2643, sport: 'football', league: 'nfl', team: 'Patriots' },
  { name: 'Caesars Superdome', lat: 29.9511, lng: -90.0812, sport: 'football', league: 'nfl', team: 'Saints' },
  { name: 'MetLife Stadium', lat: 40.8135, lng: -74.0745, sport: 'football', league: 'nfl', team: 'Giants' },
  { name: 'MetLife Stadium', lat: 40.8135, lng: -74.0745, sport: 'football', league: 'nfl', team: 'Jets' },
  { name: 'Lincoln Financial Field', lat: 39.9008, lng: -75.1675, sport: 'football', league: 'nfl', team: 'Eagles' },
  { name: 'Acrisure Stadium', lat: 40.4468, lng: -80.0158, sport: 'football', league: 'nfl', team: 'Steelers' },
  { name: "Levi's Stadium", lat: 37.4033, lng: -121.9694, sport: 'football', league: 'nfl', team: '49ers' },
  { name: 'Lumen Field', lat: 47.5952, lng: -122.3316, sport: 'football', league: 'nfl', team: 'Seahawks' },
  { name: 'Raymond James Stadium', lat: 27.9759, lng: -82.5033, sport: 'football', league: 'nfl', team: 'Buccaneers' },
  { name: 'Nissan Stadium', lat: 36.1665, lng: -86.7713, sport: 'football', league: 'nfl', team: 'Titans' },
  { name: 'Northwest Stadium', lat: 38.9076, lng: -76.8645, sport: 'football', league: 'nfl', team: 'Commanders' },
  // NBA
  { name: 'State Farm Arena', lat: 33.7573, lng: -84.3963, sport: 'basketball', league: 'nba', team: 'Hawks' },
  { name: 'TD Garden', lat: 42.3662, lng: -71.0621, sport: 'basketball', league: 'nba', team: 'Celtics' },
  { name: 'Barclays Center', lat: 40.6826, lng: -73.9754, sport: 'basketball', league: 'nba', team: 'Nets' },
  { name: 'Spectrum Center', lat: 35.2251, lng: -80.8392, sport: 'basketball', league: 'nba', team: 'Hornets' },
  { name: 'United Center', lat: 41.8807, lng: -87.6742, sport: 'basketball', league: 'nba', team: 'Bulls' },
  { name: 'Rocket Arena', lat: 41.4965, lng: -81.6882, sport: 'basketball', league: 'nba', team: 'Cavaliers' },
  { name: 'American Airlines Center', lat: 32.7905, lng: -96.8103, sport: 'basketball', league: 'nba', team: 'Mavericks' },
  { name: 'Ball Arena', lat: 39.7487, lng: -105.0077, sport: 'basketball', league: 'nba', team: 'Nuggets' },
  { name: 'Little Caesars Arena', lat: 42.3410, lng: -83.0552, sport: 'basketball', league: 'nba', team: 'Pistons' },
  { name: 'Chase Center', lat: 37.7680, lng: -122.3877, sport: 'basketball', league: 'nba', team: 'Warriors' },
  { name: 'Toyota Center', lat: 29.7508, lng: -95.3621, sport: 'basketball', league: 'nba', team: 'Rockets' },
  { name: 'Gainbridge Fieldhouse', lat: 39.7639, lng: -86.1555, sport: 'basketball', league: 'nba', team: 'Pacers' },
  { name: 'Intuit Dome', lat: 33.9459, lng: -118.3410, sport: 'basketball', league: 'nba', team: 'Clippers' },
  { name: 'Crypto.com Arena', lat: 34.0430, lng: -118.2673, sport: 'basketball', league: 'nba', team: 'Lakers' },
  { name: 'FedExForum', lat: 35.1382, lng: -90.0505, sport: 'basketball', league: 'nba', team: 'Grizzlies' },
  { name: 'Kaseya Center', lat: 25.7814, lng: -80.1870, sport: 'basketball', league: 'nba', team: 'Heat' },
  { name: 'Fiserv Forum', lat: 43.0451, lng: -87.9172, sport: 'basketball', league: 'nba', team: 'Bucks' },
  { name: 'Target Center', lat: 44.9795, lng: -93.2760, sport: 'basketball', league: 'nba', team: 'Timberwolves' },
  { name: 'Smoothie King Center', lat: 29.9490, lng: -90.0821, sport: 'basketball', league: 'nba', team: 'Pelicans' },
  { name: 'Madison Square Garden', lat: 40.7505, lng: -73.9934, sport: 'basketball', league: 'nba', team: 'Knicks' },
  { name: 'Paycom Center', lat: 35.4634, lng: -97.5151, sport: 'basketball', league: 'nba', team: 'Thunder' },
  { name: 'Kia Center', lat: 28.5392, lng: -81.3839, sport: 'basketball', league: 'nba', team: 'Magic' },
  { name: 'Wells Fargo Center', lat: 39.9012, lng: -75.1720, sport: 'basketball', league: 'nba', team: '76ers' },
  { name: 'PHX Arena', lat: 33.4457, lng: -112.0712, sport: 'basketball', league: 'nba', team: 'Suns' },
  { name: 'Moda Center', lat: 45.5316, lng: -122.6668, sport: 'basketball', league: 'nba', team: 'Trail Blazers' },
  { name: 'Golden 1 Center', lat: 38.5802, lng: -121.4997, sport: 'basketball', league: 'nba', team: 'Kings' },
  { name: 'Frost Bank Center', lat: 29.4269, lng: -98.4375, sport: 'basketball', league: 'nba', team: 'Spurs' },
  { name: 'Scotiabank Arena', lat: 43.6435, lng: -79.3791, sport: 'basketball', league: 'nba', team: 'Raptors' },
  { name: 'Delta Center', lat: 40.7683, lng: -111.9011, sport: 'basketball', league: 'nba', team: 'Jazz' },
  { name: 'Capital One Arena', lat: 38.8981, lng: -77.0209, sport: 'basketball', league: 'nba', team: 'Wizards' },
  // WNBA (15 teams as of 2026 — Portland Fire and Toronto Tempo new this season)
  { name: 'Gateway Center Arena', lat: 33.6146, lng: -84.4568, sport: 'basketball', league: 'wnba', team: 'Dream' },
  { name: 'Wintrust Arena', lat: 41.8534, lng: -87.6199, sport: 'basketball', league: 'wnba', team: 'Sky' },
  { name: 'Mohegan Sun Arena', lat: 41.4949, lng: -72.0951, sport: 'basketball', league: 'wnba', team: 'Sun' },
  { name: 'College Park Center', lat: 32.7296, lng: -97.1084, sport: 'basketball', league: 'wnba', team: 'Wings' },
  { name: 'Chase Center', lat: 37.7680, lng: -122.3877, sport: 'basketball', league: 'wnba', team: 'Valkyries' },
  { name: 'Gainbridge Fieldhouse', lat: 39.7639, lng: -86.1555, sport: 'basketball', league: 'wnba', team: 'Fever' },
  { name: 'Michelob Ultra Arena', lat: 36.1025, lng: -115.1745, sport: 'basketball', league: 'wnba', team: 'Aces' },
  { name: 'Crypto.com Arena', lat: 34.0430, lng: -118.2673, sport: 'basketball', league: 'wnba', team: 'Sparks' },
  { name: 'Target Center', lat: 44.9795, lng: -93.2760, sport: 'basketball', league: 'wnba', team: 'Lynx' },
  { name: 'Barclays Center', lat: 40.6826, lng: -73.9754, sport: 'basketball', league: 'wnba', team: 'Liberty' },
  { name: 'PHX Arena', lat: 33.4457, lng: -112.0712, sport: 'basketball', league: 'wnba', team: 'Mercury' },
  { name: 'Moda Center', lat: 45.5316, lng: -122.6668, sport: 'basketball', league: 'wnba', team: 'Fire' },
  { name: 'Climate Pledge Arena', lat: 47.6221, lng: -122.3540, sport: 'basketball', league: 'wnba', team: 'Storm' },
  { name: 'Coca-Cola Coliseum', lat: 43.6359, lng: -79.4187, sport: 'basketball', league: 'wnba', team: 'Tempo' },
  { name: 'CareFirst Arena', lat: 38.8473, lng: -76.9885, sport: 'basketball', league: 'wnba', team: 'Mystics' },
  // NHL (Utah Mammoth, not Arizona — the Coyotes relocated in 2024)
  { name: 'Honda Center', lat: 33.8078, lng: -117.8767, sport: 'hockey', league: 'nhl', team: 'Ducks' },
  { name: 'TD Garden', lat: 42.3662, lng: -71.0621, sport: 'hockey', league: 'nhl', team: 'Bruins' },
  { name: 'KeyBank Center', lat: 42.8750, lng: -78.8764, sport: 'hockey', league: 'nhl', team: 'Sabres' },
  { name: 'Scotiabank Saddledome', lat: 51.0374, lng: -114.0519, sport: 'hockey', league: 'nhl', team: 'Flames' },
  { name: 'Lenovo Center', lat: 35.8033, lng: -78.7219, sport: 'hockey', league: 'nhl', team: 'Hurricanes' },
  { name: 'United Center', lat: 41.8807, lng: -87.6742, sport: 'hockey', league: 'nhl', team: 'Blackhawks' },
  { name: 'Ball Arena', lat: 39.7487, lng: -105.0077, sport: 'hockey', league: 'nhl', team: 'Avalanche' },
  { name: 'Nationwide Arena', lat: 39.9692, lng: -83.0061, sport: 'hockey', league: 'nhl', team: 'Blue Jackets' },
  { name: 'American Airlines Center', lat: 32.7905, lng: -96.8103, sport: 'hockey', league: 'nhl', team: 'Stars' },
  { name: 'Little Caesars Arena', lat: 42.3410, lng: -83.0552, sport: 'hockey', league: 'nhl', team: 'Red Wings' },
  { name: 'Rogers Place', lat: 53.5469, lng: -113.4979, sport: 'hockey', league: 'nhl', team: 'Oilers' },
  { name: 'Amerant Bank Arena', lat: 26.1584, lng: -80.3255, sport: 'hockey', league: 'nhl', team: 'Panthers' },
  { name: 'Crypto.com Arena', lat: 34.0430, lng: -118.2673, sport: 'hockey', league: 'nhl', team: 'Kings' },
  { name: 'Xcel Energy Center', lat: 44.9448, lng: -93.1011, sport: 'hockey', league: 'nhl', team: 'Wild' },
  { name: 'Bell Centre', lat: 45.4961, lng: -73.5693, sport: 'hockey', league: 'nhl', team: 'Canadiens' },
  { name: 'Bridgestone Arena', lat: 36.1593, lng: -86.7787, sport: 'hockey', league: 'nhl', team: 'Predators' },
  { name: 'Prudential Center', lat: 40.7336, lng: -74.1710, sport: 'hockey', league: 'nhl', team: 'Devils' },
  { name: 'UBS Arena', lat: 40.7230, lng: -73.5919, sport: 'hockey', league: 'nhl', team: 'Islanders' },
  { name: 'Madison Square Garden', lat: 40.7505, lng: -73.9934, sport: 'hockey', league: 'nhl', team: 'Rangers' },
  { name: 'Canadian Tire Centre', lat: 45.2969, lng: -75.9270, sport: 'hockey', league: 'nhl', team: 'Senators' },
  { name: 'Wells Fargo Center', lat: 39.9012, lng: -75.1720, sport: 'hockey', league: 'nhl', team: 'Flyers' },
  { name: 'PPG Paints Arena', lat: 40.4394, lng: -79.9892, sport: 'hockey', league: 'nhl', team: 'Penguins' },
  { name: 'SAP Center', lat: 37.3327, lng: -121.9012, sport: 'hockey', league: 'nhl', team: 'Sharks' },
  { name: 'Climate Pledge Arena', lat: 47.6221, lng: -122.3540, sport: 'hockey', league: 'nhl', team: 'Kraken' },
  { name: 'Enterprise Center', lat: 38.6266, lng: -90.2026, sport: 'hockey', league: 'nhl', team: 'Blues' },
  { name: 'Amalie Arena', lat: 27.9427, lng: -82.4518, sport: 'hockey', league: 'nhl', team: 'Lightning' },
  { name: 'Scotiabank Arena', lat: 43.6435, lng: -79.3791, sport: 'hockey', league: 'nhl', team: 'Maple Leafs' },
  { name: 'Delta Center', lat: 40.7683, lng: -111.9011, sport: 'hockey', league: 'nhl', team: 'Mammoth' },
  { name: 'Rogers Arena', lat: 49.2778, lng: -123.1088, sport: 'hockey', league: 'nhl', team: 'Canucks' },
  { name: 'T-Mobile Arena', lat: 36.1029, lng: -115.1786, sport: 'hockey', league: 'nhl', team: 'Golden Knights' },
  { name: 'Capital One Arena', lat: 38.8981, lng: -77.0209, sport: 'hockey', league: 'nhl', team: 'Capitals' },
  { name: 'Canada Life Centre', lat: 49.8927, lng: -97.1435, sport: 'hockey', league: 'nhl', team: 'Jets' },
  // MLS
  { name: 'Mercedes-Benz Stadium', lat: 33.7554, lng: -84.4008, sport: 'soccer', league: 'usa.1', team: 'Atlanta United' },
  { name: 'Q2 Stadium', lat: 30.3868, lng: -97.7195, sport: 'soccer', league: 'usa.1', team: 'Austin' },
  { name: 'Bank of America Stadium', lat: 35.2258, lng: -80.8528, sport: 'soccer', league: 'usa.1', team: 'Charlotte' },
  { name: 'Soldier Field', lat: 41.8623, lng: -87.6167, sport: 'soccer', league: 'usa.1', team: 'Chicago Fire' },
  { name: 'TQL Stadium', lat: 39.1153, lng: -84.5605, sport: 'soccer', league: 'usa.1', team: 'Cincinnati' },
  { name: "Dick's Sporting Goods Park", lat: 39.8035, lng: -104.6903, sport: 'soccer', league: 'usa.1', team: 'Colorado Rapids' },
  { name: 'Lower.com Field', lat: 39.9689, lng: -83.0173, sport: 'soccer', league: 'usa.1', team: 'Columbus Crew' },
  { name: 'Toyota Stadium', lat: 33.1538, lng: -96.8351, sport: 'soccer', league: 'usa.1', team: 'FC Dallas' },
  { name: 'Audi Field', lat: 38.8678, lng: -77.0121, sport: 'soccer', league: 'usa.1', team: 'D.C. United' },
  { name: 'Shell Energy Stadium', lat: 29.7521, lng: -95.3517, sport: 'soccer', league: 'usa.1', team: 'Houston Dynamo' },
  { name: 'Chase Stadium', lat: 26.1953, lng: -80.1748, sport: 'soccer', league: 'usa.1', team: 'Inter Miami' },
  { name: 'Dignity Health Sports Park', lat: 33.8644, lng: -118.2611, sport: 'soccer', league: 'usa.1', team: 'LA Galaxy' },
  { name: 'BMO Stadium', lat: 34.0126, lng: -118.2851, sport: 'soccer', league: 'usa.1', team: 'LAFC' },
  { name: 'Allianz Field', lat: 44.9530, lng: -93.1657, sport: 'soccer', league: 'usa.1', team: 'Minnesota United' },
  { name: 'Geodis Park', lat: 36.1330, lng: -86.7622, sport: 'soccer', league: 'usa.1', team: 'Nashville SC' },
  { name: 'Gillette Stadium', lat: 42.0909, lng: -71.2643, sport: 'soccer', league: 'usa.1', team: 'New England Revolution' },
  { name: 'Red Bull Arena', lat: 40.7369, lng: -74.1503, sport: 'soccer', league: 'usa.1', team: 'New York Red Bulls' },
  { name: "Inter&Co Stadium", lat: 28.5411, lng: -81.3892, sport: 'soccer', league: 'usa.1', team: 'Orlando City' },
  { name: 'Subaru Park', lat: 39.8328, lng: -75.3782, sport: 'soccer', league: 'usa.1', team: 'Philadelphia Union' },
  { name: 'Providence Park', lat: 45.5215, lng: -122.6919, sport: 'soccer', league: 'usa.1', team: 'Portland Timbers' },
  { name: 'America First Field', lat: 40.5828, lng: -111.8936, sport: 'soccer', league: 'usa.1', team: 'Real Salt Lake' },
  { name: 'Snapdragon Stadium', lat: 32.7831, lng: -117.1195, sport: 'soccer', league: 'usa.1', team: 'San Diego FC' },
  { name: 'PayPal Park', lat: 37.3524, lng: -121.9251, sport: 'soccer', league: 'usa.1', team: 'San Jose Earthquakes' },
  { name: 'Lumen Field', lat: 47.5952, lng: -122.3316, sport: 'soccer', league: 'usa.1', team: 'Seattle Sounders' },
  { name: "Children's Mercy Park", lat: 39.1224, lng: -94.8231, sport: 'soccer', league: 'usa.1', team: 'Sporting KC' },
  { name: 'CityPark', lat: 38.6270, lng: -90.2151, sport: 'soccer', league: 'usa.1', team: 'St. Louis City' },
  { name: 'BMO Field', lat: 43.6332, lng: -79.4185, sport: 'soccer', league: 'usa.1', team: 'Toronto FC' },
  { name: 'BC Place', lat: 49.2768, lng: -123.1119, sport: 'soccer', league: 'usa.1', team: 'Vancouver Whitecaps' },
  // NWSL — newest, fastest-changing league here; verify before fully trusting
  { name: 'BMO Stadium', lat: 34.0126, lng: -118.2851, sport: 'soccer', league: 'usa.nwsl', team: 'Angel City' },
  { name: 'PayPal Park', lat: 37.3524, lng: -121.9251, sport: 'soccer', league: 'usa.nwsl', team: 'Bay FC' },
  { name: 'CPKC Stadium', lat: 39.0827, lng: -94.5776, sport: 'soccer', league: 'usa.nwsl', team: 'Kansas City Current' },
  { name: 'Shell Energy Stadium', lat: 29.7521, lng: -95.3517, sport: 'soccer', league: 'usa.nwsl', team: 'Houston Dash' },
  { name: 'Red Bull Arena', lat: 40.7369, lng: -74.1503, sport: 'soccer', league: 'usa.nwsl', team: 'Gotham FC' },
  { name: 'WakeMed Soccer Park', lat: 35.7448, lng: -78.8286, sport: 'soccer', league: 'usa.nwsl', team: 'North Carolina Courage' },
  { name: "Inter&Co Stadium", lat: 28.5411, lng: -81.3892, sport: 'soccer', league: 'usa.nwsl', team: 'Orlando Pride' },
  { name: 'Providence Park', lat: 45.5215, lng: -122.6919, sport: 'soccer', league: 'usa.nwsl', team: 'Portland Thorns' },
  { name: 'Lynn Family Stadium', lat: 38.2483, lng: -85.7735, sport: 'soccer', league: 'usa.nwsl', team: 'Racing Louisville' },
  { name: 'Snapdragon Stadium', lat: 32.7831, lng: -117.1195, sport: 'soccer', league: 'usa.nwsl', team: 'San Diego Wave' },
  { name: 'Lumen Field', lat: 47.5952, lng: -122.3316, sport: 'soccer', league: 'usa.nwsl', team: 'Seattle Reign' },
  { name: 'America First Field', lat: 40.5828, lng: -111.8936, sport: 'soccer', league: 'usa.nwsl', team: 'Utah Royals' },
  { name: 'Audi Field', lat: 38.8678, lng: -77.0121, sport: 'soccer', league: 'usa.nwsl', team: 'Washington Spirit' }
];

function _haversineMeters(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── SPORT FLOURISH ── a short, skippable celebration. Originally just for
// confirming a game/festival at creation time; now also plays whenever any
// memory is opened, themed to whatever kind of memory it is — sport,
// festival, or otherwise. Known vibes get a specific animation; anything
// else (a custom vibe like "Bar Crawl" or "Chill Night" with an emoji this
// map doesn't recognize) still gets the generic default rather than
// nothing, since the point is every memory gets *something* fun.
var SPORT_FLOURISH = {
  mlb: { emoji: '⚾', caption: 'Play ball!' },
  football: { emoji: '🏈', caption: 'Touchdown!' },
  basketball: { emoji: '🏀', caption: 'Nothing but net!' },
  hockey: { emoji: '🏒', caption: 'Top shelf!' },
  soccer: { emoji: '⚽', caption: 'Goooal!' },
  festival: { emoji: '🎪', caption: "Let's go!" },
  hangout: { emoji: '🍺', caption: 'Cheers!' },
  meal: { emoji: '🍽️', caption: 'Bon appétit!' },
  trip: { emoji: '✈️', caption: 'Bon voyage!' },
  home: { emoji: '🏡', caption: 'Home sweet home' },
  comedy: { emoji: '🎤', caption: 'And she sticks the landing!' },
  movie: { emoji: '🎬', caption: 'Lights down' },
  concert: { emoji: '🎵', caption: 'Encore!' },
  default: { emoji: '✨', caption: 'There you are' }
};
// Reads the emoji off the front of whatever vibe is saved on the memory
// ("⚾ Game", "🍻 Bar Crawl", a fully custom one) and matches it to a
// themed animation where recognized, falling back to the generic default
// rather than guessing at emoji this map was never taught.
var VIBE_EMOJI_TO_FLOURISH = {
  '⚾': 'mlb', '🏈': 'football', '🏀': 'basketball', '🏒': 'hockey', '⚽': 'soccer',
  '🎪': 'festival',
  '🍺': 'hangout', '🍻': 'hangout', '🍸': 'hangout', '🥂': 'hangout',
  '🍽️': 'meal', '🍴': 'meal', '🍕': 'meal', '🍔': 'meal',
  '✈️': 'trip', '🧳': 'trip',
  '🏠': 'home', '🛋️': 'home', '🏡': 'home',
  '🎤': 'comedy', '😂': 'comedy',
  '🎬': 'movie', '🍿': 'movie',
  '🎵': 'concert', '🎶': 'concert', '🎸': 'concert', '🎧': 'concert'
};
function _flourishKeyForVibe(vibe) {
  var emoji = String(vibe || '').trim().split(' ')[0];
  return VIBE_EMOJI_TO_FLOURISH[emoji] || 'default';
}
// The sport tagged directly on an attached box score is a more reliable
// signal than the vibe emoji — vibe can be edited separately or just never
// set on an older memory, but the sport that was actually searched for and
// attached can't drift. Only falls back to reading the vibe when there's
// no box score to go by at all (a hangout, a meal, anything non-sport).
function _flourishKeyForMemory(m) {
  if (m && m.boxScore && m.boxScore.sport) {
    var bucket = _flourishKeyForBsModalSport(m.boxScore.sport);
    if (SPORT_FLOURISH[bucket]) return bucket;
  }
  return _flourishKeyForVibe(m && m.vibe);
}
function _flourishKeyForBsModalSport(s) {
  if (s === 'nfl') return 'football';
  if (s === 'nba' || s === 'wnba') return 'basketball';
  if (s === 'nhl') return 'hockey';
  if (s === 'mls' || s === 'nwsl') return 'soccer';
  return 'mlb';
}
window._sportFlourishTimer = null;
window._sportFlourishOnDone = null;
function _skipSportFlourish() {
  var overlay = document.getElementById('sport-flourish');
  if (!overlay || overlay.style.display === 'none') return;
  clearTimeout(window._sportFlourishTimer);
  overlay.style.opacity = '0';
  var done = window._sportFlourishOnDone;
  window._sportFlourishOnDone = null;
  setTimeout(function(){ overlay.style.display = 'none'; if (typeof done === 'function') done(); }, 200);
}
function _playSportFlourish(sportKey, onDone) {
  var overlay = document.getElementById('sport-flourish');
  var emojiEl = document.getElementById('sport-flourish-emoji');
  var captionEl = document.getElementById('sport-flourish-caption');
  var d = SPORT_FLOURISH[sportKey];
  if (!overlay || !emojiEl || !captionEl || !d) { if (typeof onDone === 'function') onDone(); return; }
  window._sportFlourishOnDone = onDone;
  emojiEl.textContent = d.emoji;
  captionEl.textContent = d.caption;
  emojiEl.style.transition = 'none';
  emojiEl.style.transform = 'scale(0.3) rotate(-15deg)';
  emojiEl.style.opacity = '0';
  captionEl.style.opacity = '0';
  overlay.style.display = 'flex';
  overlay.style.opacity = '0';
  requestAnimationFrame(function(){
    overlay.style.opacity = '1';
    requestAnimationFrame(function(){
      emojiEl.style.transition = 'transform 0.5s cubic-bezier(.34,1.56,.64,1),opacity 0.3s ease';
      emojiEl.style.transform = 'scale(1) rotate(0deg)';
      emojiEl.style.opacity = '1';
      setTimeout(function(){ captionEl.style.opacity = '1'; }, 150);
    });
  });
  window._sportFlourishTimer = setTimeout(function(){
    overlay.style.opacity = '0';
    setTimeout(function(){
      overlay.style.display = 'none';
      var done = window._sportFlourishOnDone;
      window._sportFlourishOnDone = null;
      if (typeof done === 'function') done();
    }, 220);
  }, 1300);
}

function _matchNearbyVenue(lat, lng) {
  var ballpark = null, ballparkDist = Infinity;
  MLB_BALLPARKS.forEach(function(bp){
    var d = _haversineMeters(lat, lng, bp.lat, bp.lng);
    if (d < ballparkDist) { ballparkDist = d; ballpark = bp; }
  });
  if (ballpark && ballparkDist <= 600) return { type: 'ballpark', venue: ballpark };

  // Other sports: match on venue name+coordinates, then collect every team
  // that plays there (arenas are often shared across leagues) rather than
  // just the single nearest entry — same location can be an NBA team, an
  // NHL team, and a WNBA team depending on the day.
  var closestName = null, closestDist = Infinity;
  OTHER_SPORTS_VENUES.forEach(function(v){
    var d = _haversineMeters(lat, lng, v.lat, v.lng);
    if (d < closestDist) { closestDist = d; closestName = v.name; }
  });
  if (closestName && closestDist <= 500) {
    var teams = OTHER_SPORTS_VENUES.filter(function(v){ return v.name === closestName; });
    return { type: 'multisport', venueName: closestName, teams: teams };
  }

  var festival = null, festivalDist = Infinity;
  FESTIVAL_VENUES.forEach(function(fv){
    var d = _haversineMeters(lat, lng, fv.lat, fv.lng);
    if (d <= fv.radiusM && d < festivalDist) { festivalDist = d; festival = fv; }
  });
  if (festival) return { type: 'festival', venue: festival };

  return { type: 'none' };
}

function chooseMomentType(type) {
  window._momentType = type;
  window._stubMode = null; // v7.1.0
  var step0 = document.getElementById('create-step-0');
  if (step0) step0.style.display = 'none';
  var indBar = document.getElementById('moment-step-indicator');
  if (type === 'past') {
    // v7.1.0: ask what it was first (stub for games/concerts/festivals)
    if (typeof mnShowKind === 'function') { mnShowKind(); return; }
    if (indBar) indBar.style.display = 'flex';
    goToStep(1);
  } else if (type === 'future') {
    window._momentType = null;
    if (typeof pbOpen === 'function') pbOpen();
  } else if (type === 'now') {
    if (indBar) indBar.style.display = 'none';
    startHappeningNow();
  }
}

function startHappeningNow() {
  var step = document.getElementById('create-step-now');
  var ask = document.getElementById('now-ask');
  var result = document.getElementById('now-result');
  if (step) step.style.display = 'flex';
  if (ask) ask.style.display = 'block';
  if (result) { result.style.display = 'none'; result.innerHTML = ''; }
  var btn = document.getElementById('now-use-location-btn');
  if (btn) { btn.textContent = 'Find where I am'; btn.disabled = false; }
}

function requestNowLocation() {
  if (!navigator.geolocation) {
    if (typeof ib_toast === 'function') ib_toast('Location not available on this device');
    skipNowLocation();
    return;
  }
  var btn = document.getElementById('now-use-location-btn');
  if (btn) { btn.textContent = 'Finding you…'; btn.disabled = true; }
  navigator.geolocation.getCurrentPosition(function(pos){
    _handleNowLocation(pos.coords.latitude, pos.coords.longitude);
  }, function(err){
    console.error('Geolocation error:', err);
    if (typeof ib_toast === 'function') ib_toast("Couldn't get your location — enter it yourself instead");
    skipNowLocation();
  }, { timeout: 10000, maximumAge: 0 });
}

function _handleNowLocation(lat, lng) {
  var match = _matchNearbyVenue(lat, lng);
  if (match.type === 'ballpark') { _renderNowBallpark(match.venue); }
  else if (match.type === 'multisport') { _renderNowMultisport(match.venueName, match.teams); }
  else if (match.type === 'festival') { _renderNowFestival(match.venue); }
  else { _renderNowPin(lat, lng); }
}

function _renderNowBallpark(bp) {
  var ask = document.getElementById('now-ask');
  var result = document.getElementById('now-result');
  if (ask) ask.style.display = 'none';
  if (!result) return;
  result.style.display = 'block';
  result.innerHTML = '<div style="padding:24px 20px;text-align:center;color:var(--subtle);font-size:13px">Looking up today\'s game at ' + _escapeHtml(bp.name) + '…</div>';
  fetch('/api/mlb?mode=schedule&date=' + encodeURIComponent(_todayLocal()))
    .then(function(r){ return r.json(); })
    .then(function(data){
      var games = data.games || [];
      var g = games.filter(function(gm){
        return (gm.home || '').indexOf(bp.team) !== -1 || (gm.away || '').indexOf(bp.team) !== -1;
      })[0];
      if (!g) { _renderNowNoGame(bp); return; }
      window._nowGamePk = g.gamePk;
      var scoreLine = (g.awayScore != null && g.homeScore != null) ? (g.awayScore + '–' + g.homeScore) : (g.status || '');
      result.innerHTML =
        '<div style="margin:0 20px;background:var(--card);border-radius:18px;padding:16px;border:1px solid rgba(168,159,232,.2)">' +
          '<div style="font-size:11.5px;color:var(--lav);font-weight:700;margin-bottom:8px">📍 You\'re at ' + _escapeHtml(bp.name) + '</div>' +
          '<div style="font-size:16px;font-weight:800;color:var(--black)">' + _escapeHtml(g.away || '?') + ' @ ' + _escapeHtml(g.home || '?') + '</div>' +
          '<div style="font-size:13px;color:var(--subtle);margin-top:4px">' + _escapeHtml(String(scoreLine)) + '</div>' +
          '<button onclick="useNowGame()" style="width:100%;margin-top:14px;background:var(--indigo);color:white;border:none;border-radius:12px;padding:12px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">Use this game</button>' +
        '</div>' +
        '<div style="padding:14px 20px 0;text-align:center"><button onclick="skipNowLocation()" style="background:none;border:none;color:var(--subtle);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Not this — enter it myself</button></div>';
    })
    .catch(function(err){
      console.error('Happening-now schedule lookup error:', err);
      _renderNowNoGame(bp);
    });
}

function _renderNowNoGame(bp) {
  var result = document.getElementById('now-result');
  if (!result) return;
  result.innerHTML =
    '<div style="margin:0 20px;background:var(--card);border-radius:18px;padding:16px;border:1px solid rgba(168,159,232,.2);text-align:center">' +
      '<div style="font-size:11.5px;color:var(--lav);font-weight:700;margin-bottom:6px">📍 You\'re at ' + _escapeHtml(bp.name) + '</div>' +
      '<div style="font-size:13px;color:var(--subtle);line-height:1.5">No game found there today — might be an off day. You can still log this moment and search manually.</div>' +
      '<button onclick="skipNowLocation()" style="width:100%;margin-top:14px;background:var(--indigo);color:white;border:none;border-radius:12px;padding:12px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">Continue anyway</button>' +
    '</div>';
}

function _toEspnDate(isoDate) { return String(isoDate || '').replace(/-/g, ''); }

function _fetchTeamGameToday(entry) {
  var today = _todayLocal();
  if (entry.league === 'nhl') {
    return fetch('/api/nhl?mode=schedule&date=' + encodeURIComponent(today))
      .then(function(r){ return r.json(); })
      .then(function(data){
        var g = (data.games || []).filter(function(gm){
          return (gm.home || '').indexOf(entry.team) !== -1 || (gm.away || '').indexOf(entry.team) !== -1;
        })[0];
        return g ? { entry: entry, game: g } : null;
      })
      .catch(function(){ return null; });
  }
  return fetch('/api/espn?league=' + encodeURIComponent(entry.league) + '&mode=schedule&date=' + encodeURIComponent(_toEspnDate(today)))
    .then(function(r){ return r.json(); })
    .then(function(data){
      var g = (data.games || []).filter(function(gm){
        return (gm.home || '').indexOf(entry.team) !== -1 || (gm.away || '').indexOf(entry.team) !== -1;
      })[0];
      return g ? { entry: entry, game: g } : null;
    })
    .catch(function(){ return null; });
}

function _renderNowMultisport(venueName, teams) {
  var ask = document.getElementById('now-ask');
  var result = document.getElementById('now-result');
  if (ask) ask.style.display = 'none';
  if (!result) return;
  result.style.display = 'block';
  result.innerHTML = '<div style="padding:24px 20px;text-align:center;color:var(--subtle);font-size:13px">Looking up today\'s game at ' + _escapeHtml(venueName) + '…</div>';
  Promise.all(teams.map(_fetchTeamGameToday)).then(function(results){
    var found = results.filter(Boolean)[0];
    if (!found) { _renderNowNoGame({ name: venueName }); return; }
    window._nowGame = found;
    var g = found.game;
    var scoreLine = (g.awayScore != null && g.homeScore != null) ? (g.awayScore + '–' + g.homeScore) : (g.status || '');
    result.innerHTML =
      '<div style="margin:0 20px;background:var(--card);border-radius:18px;padding:16px;border:1px solid rgba(168,159,232,.2)">' +
        '<div style="font-size:11.5px;color:var(--lav);font-weight:700;margin-bottom:8px">📍 You\'re at ' + _escapeHtml(venueName) + '</div>' +
        '<div style="font-size:16px;font-weight:800;color:var(--black)">' + _escapeHtml(g.away || '?') + ' @ ' + _escapeHtml(g.home || '?') + '</div>' +
        '<div style="font-size:13px;color:var(--subtle);margin-top:4px">' + _escapeHtml(String(scoreLine)) + '</div>' +
        '<button onclick="useNowMultisportGame()" style="width:100%;margin-top:14px;background:var(--indigo);color:white;border:none;border-radius:12px;padding:12px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">Use this game</button>' +
      '</div>' +
      '<div style="padding:14px 20px 0;text-align:center"><button onclick="skipNowLocation()" style="background:none;border:none;color:var(--subtle);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Not this — enter it myself</button></div>';
  }).catch(function(err){
    console.error('Happening-now multisport lookup error:', err);
    _renderNowNoGame({ name: venueName });
  });
}

function useNowMultisportGame() {
  var found = window._nowGame;
  if (!found) { skipNowLocation(); return; }
  if (typeof ib_toast === 'function') ib_toast('Loading game details…');
  var entry = found.entry, g = found.game;
  var fetchUrl = entry.league === 'nhl'
    ? '/api/nhl?mode=boxscore&gamePk=' + encodeURIComponent(g.gamePk)
    : '/api/espn?league=' + encodeURIComponent(entry.league) + '&mode=boxscore&eventId=' + encodeURIComponent(g.gamePk);
  fetch(fetchUrl)
    .then(function(r){ return r.json(); })
    .then(function(box){
      window._momentBoxScore = _sanitizeForFirestore(box);
      window._momentBoxScore.sport = entry.league;
      var sportEmoji = { football: '🏈', basketball: '🏀', hockey: '🏒', soccer: '⚽' }[entry.sport] || '🏆';
      _playSportFlourish(entry.sport, function(){
        _proceedToMemoryForm();
        quickVibe(sportEmoji + ' Game');
        var dateEl = document.getElementById('moment-date');
        if (dateEl) dateEl.value = _todayLocal();
        if (typeof _renderMomentBoxScoreSelected === 'function') _renderMomentBoxScoreSelected(window._momentBoxScore);
      });
    })
    .catch(function(err){
      console.error('Happening-now multisport boxscore error:', err);
      if (typeof ib_toast === 'function') ib_toast('Could not load game details — continuing anyway');
      _proceedToMemoryForm();
    });
}

function useNowGame() {
  if (!window._nowGamePk) { skipNowLocation(); return; }
  if (typeof ib_toast === 'function') ib_toast('Loading game…');
  var gamePk = window._nowGamePk;
  fetch('/api/mlb?mode=boxscore&gamePk=' + encodeURIComponent(gamePk))
    .then(function(r){ return r.json(); })
    .then(function(box){
      window._momentBoxScore = _sanitizeForFirestore(box);
      window._momentBoxScore.sport = 'mlb';
      _playSportFlourish('mlb', function(){
        _proceedToMemoryForm();
        quickVibe('⚾ Game');
        var dateEl = document.getElementById('moment-date');
        if (dateEl) dateEl.value = _todayLocal();
        if (typeof _renderMomentBoxScoreSelected === 'function') _renderMomentBoxScoreSelected(window._momentBoxScore);
      });
    })
    .catch(function(err){
      console.error('Happening-now boxscore error:', err);
      if (typeof ib_toast === 'function') ib_toast('Could not load game — continuing anyway');
      _proceedToMemoryForm();
    });
}

function _renderNowFestival(fv) {
  var ask = document.getElementById('now-ask');
  var result = document.getElementById('now-result');
  if (ask) ask.style.display = 'none';
  if (!result) return;
  result.style.display = 'block';
  result.innerHTML =
    '<div style="margin:0 20px;background:var(--card);border-radius:18px;padding:16px;border:1px solid rgba(168,159,232,.2);text-align:center">' +
      '<div style="font-size:11.5px;color:var(--lav);font-weight:700;margin-bottom:8px">📍 You\'re near ' + _escapeHtml(fv.name) + '</div>' +
      '<div style="font-size:16px;font-weight:800;color:var(--black)">Looks like ' + _escapeHtml(fv.label) + '</div>' +
      '<button onclick="useNowFestival(\'' + fv.screen + '\')" style="width:100%;margin-top:14px;background:var(--indigo);color:white;border:none;border-radius:12px;padding:12px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">Take me there</button>' +
    '</div>' +
    '<div style="padding:14px 20px 0;text-align:center"><button onclick="skipNowLocation()" style="background:none;border:none;color:var(--subtle);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Not this — log a regular moment</button></div>';
}

function useNowFestival(screenId) {
  _playSportFlourish('festival', function(){
    backToStep0();
    nav(screenId);
  });
}

function _renderNowPin(lat, lng) {
  var ask = document.getElementById('now-ask');
  var result = document.getElementById('now-result');
  if (ask) ask.style.display = 'none';
  if (!result) return;
  window._nowCoords = { lat: lat, lng: lng };
  var gmaps = 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
  var amaps = 'https://maps.apple.com/?ll=' + lat + ',' + lng;
  result.style.display = 'block';
  result.innerHTML =
    '<div style="margin:0 20px;background:var(--card);border-radius:18px;padding:16px;border:1px solid rgba(168,159,232,.2)">' +
      '<div style="font-size:11.5px;color:var(--lav);font-weight:700;margin-bottom:10px">📍 Dropped a pin at your current location</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:14px">' +
        '<a href="' + gmaps + '" target="_blank" rel="noopener" style="flex:1;text-align:center;background:var(--bg);border:0.5px solid var(--rule);border-radius:10px;padding:8px 4px;font-size:11.5px;font-weight:700;color:var(--indigo);text-decoration:none">Google Maps</a>' +
        '<a href="' + amaps + '" target="_blank" rel="noopener" style="flex:1;text-align:center;background:var(--bg);border:0.5px solid var(--rule);border-radius:10px;padding:8px 4px;font-size:11.5px;font-weight:700;color:var(--indigo);text-decoration:none">Apple Maps</a>' +
      '</div>' +
      '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">What do you want to call this place? (optional)</div>' +
      '<input id="now-pin-label" style="width:100%;font-size:14px;color:var(--black);border:0.5px solid var(--rule);border-radius:10px;padding:10px 12px;outline:none;background:var(--bg);font-family:inherit" placeholder="e.g. Sam\'s rooftop">' +
      '<button onclick="useNowPin()" style="width:100%;margin-top:12px;background:var(--indigo);color:white;border:none;border-radius:12px;padding:12px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">Use this location</button>' +
    '</div>' +
    '<div style="padding:14px 20px 0;text-align:center"><button onclick="skipNowLocation()" style="background:none;border:none;color:var(--subtle);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Skip location</button></div>';
}

function useNowPin() {
  var labelEl = document.getElementById('now-pin-label');
  window._nowPinLabel = labelEl && labelEl.value.trim() ? labelEl.value.trim() : '';
  _proceedToMemoryForm();
}

function skipNowLocation() {
  window._nowPinLabel = '';
  _proceedToMemoryForm();
}

// There's no reverse-geocoding service wired up here, so the pin-drop case
// asks the person to name the place themselves rather than fabricating an
// address string this app has no real way to produce. Folded into the
// existing highlight field at save time rather than a whole separate
// location field + its own display path across every screen that shows a
// memory.
function _proceedToMemoryForm() {
  var step0 = document.getElementById('create-step-0');
  var stepNow = document.getElementById('create-step-now');
  if (step0) step0.style.display = 'none';
  if (stepNow) stepNow.style.display = 'none';
  var indBar = document.getElementById('moment-step-indicator');
  if (indBar) indBar.style.display = 'flex';
  window._momentType = 'past';
  goToStep(1);
}

function backToStep0() {
  ['create-step-1','create-step-2','create-step-3','create-step-4','create-step-now'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  var indBar = document.getElementById('moment-step-indicator');
  if (indBar) indBar.style.display = 'none';
  var step0 = document.getElementById('create-step-0');
  if (step0) step0.style.display = 'flex';
  window._momentType = null;
}



// ── COVER PHOTO — an optional photo shown behind the title in the hero,
// and used as the card background everywhere this plan appears (Feed,
// Calendar/Memories, the detail screen). Falls back to the plain theme
// gradient when none is set. Mirrors the main-photo-preview pattern from
// Create Moment: a dashed placeholder tile that becomes the photo once
// picked, with a small ✕ overlay to clear it.




// ── FUTURE PLAN VIBES — the fixed categories a plan's vibe can be; a custom
// one gets saved to the shared customVibes bank (see below).
var FUTURE_VIBE_FIXED = ['⚾ Game','🎪 Festival','🎵 Concert','🍺 Hangout','✈️ Trip'];





// A custom "Other" vibe gets saved to the shared bank so it shows up as its
// own quick-pick pill next time — here and in the past-moment flow. Guards
// against re-saving any of this screen's own fixed categories (which could
// otherwise happen since FUTURE_VIBE_FIXED and the past-moment VIBE_EXAMPLES
// list differ slightly, e.g. "Concert" isn't one of the past-moment ones).
function _persistCustomVibeIfNewFromFuture(vibeStr) {
  if (!vibeStr) return;
  if (FUTURE_VIBE_FIXED.indexOf(vibeStr) !== -1) return;
  _persistCustomVibeIfNew(vibeStr);
}
