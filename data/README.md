# data/

## mlb-players.json (v7.78.1)

Every player who has appeared in a Major League game — about 23,700 of them —
as `[mlbamId, "First Last", firstMlbSeason, lastMlbSeason, bbrefId]`, newest
careers first. The compare picker's search (`/api/mlb?mode=search&all=1`)
reads it so retired players of any era can be found; MLB's own name search
only covers recent players. `bbrefId` is kept for a future WAR lookup.

Built from the Chadwick Baseball Bureau Register
(https://github.com/chadwickbureau/register), licensed under the Open Data
Commons Attribution License (ODC-By 1.0). To refresh, rebuild from the
register's `data/people-*.csv` files, keeping rows with `key_mlbam` and
`mlb_played_first`. Players who debut after the last refresh are still found
through MLB's live search.

## mlb-history.json (v7.80.0)

Every season and every postseason series for the 30 current MLB franchises,
keyed by MLB team id: `seasons` = `[year, W, L, rank, "NL West", team name,
flags]` (flags: D division title, W wild card, P pennant, C World Series) and
`post` = `[year, round, opponent, won 1/0, wins, losses]`, newest first. Used
by the team page's History tab (`/api/mlb?mode=history`), which adds seasons
after the file's `through` year from MLB's own standings and postseason.

Built from the Lahman Baseball Database / Baseball Databank (`Teams.csv`,
`SeriesPost.csv`), licensed under CC BY-SA 3.0 — credited under the History
list. The copy used runs through 2021.
