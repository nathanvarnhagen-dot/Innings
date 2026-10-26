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
