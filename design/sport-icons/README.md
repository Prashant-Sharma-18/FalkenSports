# Sport icon library

3D sport icons cut from `sheet.png`, with transparent backgrounds. Each is
256 × 256, full colour. They're kept here for sports the app may add later;
nothing in this folder is shipped with the app.

The app's own icons (96 px, smaller files) are in `src/assets/sports/`. Both
are made by `tools/cut_sport_icons.py`:

```bash
python tools/cut_sport_icons.py   # needs Python 3 with Pillow and NumPy
```

## Adding a sport's icon to the app

1. Add the icon's name to `APP_ICONS` in `tools/cut_sport_icons.py` and run it.
2. Import `src/assets/sports/<name>.png` in `src/components/Icons.js` and add
   it to `SPORT_ICONS` under the sport's id.

## The icons

| | | | |
| --- | --- | --- | --- |
| american-football | archery | badminton | baseball |
| basketball | billiards | bowling | boxing |
| climbing | cricket | curling | cycling |
| darts | disc-sports | diving | f1 |
| fencing | figure-skating | football | golf |
| golf-green | gymnastics | high-jump | ice-hockey |
| kayaking | lacrosse | martial-arts | mma |
| motorsport | rowing | rugby | running |
| skateboarding | skiing | snowboarding | softball |
| surfing | swimming | table-tennis | tennis |
| triathlon | ultimate | volleyball | water-polo |
| weightlifting | | | |

`football` is soccer; `ice-hockey` is used for the NHL. There's no field
hockey icon on the sheet yet: field hockey needs a new image.
