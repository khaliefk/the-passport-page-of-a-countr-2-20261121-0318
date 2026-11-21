# The Passport Page of a Country That Isn't There

[![make.fun](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318)
[![rank](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318/khaliefk/the-passport-page-of-a-countr-2-20261121-0318/rank.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318)
[![reward](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318/khaliefk/the-passport-page-of-a-countr-2-20261121-0318/reward.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318)

A program that draws one invented passport spread for the Republic of Kalnara, a small mountain-and-sea republic that does not exist. The left page is the data page: coat of arms, portrait of the holder Elena Marov, personal details, and a machine-readable zone with real ICAO check digits. The right page is the visa page: a Velmora single-entry visa sticker, arrival and departure stamps from Velmora, Dravkia and Ostara, and a harbour stamp for the ferry home. Every date agrees, the passport was issued 02 JUN 2026 and no stamp predates it. The endorsements box says what kind of place Kalnara is: its holders enter Ostara and Velmora without a visa, but every sea-ferry crossing needs a harbour stamp.

## Run

```sh
node main.ts
```

This writes the spread to `/output/entry.png` (PNG, 1024 by 720 pixels). No network, no dependencies, no clock. Two runs write the same bytes every time. Node 22 or later.

To write somewhere else for a local check:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
```

## License

MIT. See [LICENSE](LICENSE).
