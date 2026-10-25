# Фюзис: движения, личные данные и показатели — 25 октября 2026

## Реализация

- 97 упражнений: добавлены отдельные варианты обратной гиперэкстензии с блином и подъёма на носки в Смите. Исторические ID и снимки упражнений в программах сохранены.
- Перерисованы 16 демонстраций. Для гиперэкстензии 45° и пек-дека используются две фазы, для остальных — три. Атлас загружается при открытии упражнения; воспроизведение останавливается вне видимой области и скрытой вкладки, учитывает reduced motion. Старые файлы сохранены, обновлённые ссылки используют v2.
- Личные данные открываются рядом с настройками. Сохраняются в существующем профиле питания, включая пол, возраст, рост, вес, три уровня активности и шесть целей. Ручные КБЖУ и правила питания сохраняются. После заполнения формы показывается одна соответствующая модель в демонстрациях и превью.
- Каждый свой показатель доступен для редактирования и удаления из списка. В настройках аккаунта есть отдельные переключатели видимости. Скрытие и удаление определения сохраняют историю; tombstone не даёт старым измерениям заново создать удалённый показатель. Определения остаются в персональном зашифрованном хранилище.
- Справочник веществ: 31 карточка, включая пять новых: P-5-P, холин, зверобой, мелатонин и бета-аланин. Карточка омега-3 исключена по запросу пользователя. Подборка веществ сохранена; в интерфейсе нет фильтров, названий и ссылок магазинов. Нутриентные сведения о составе обычных продуктов не изменялись.

## Источники описаний

- [NIH ODS: витамин B6](https://ods.od.nih.gov/factsheets/VitaminB6-HealthProfessional/)
- [NIH ODS: холин](https://ods.od.nih.gov/factsheets/Choline-HealthProfessional/)
- [NCCIH: зверобой](https://www.nccih.nih.gov/health/st-johns-wort)
- [NCCIH: мелатонин](https://www.nccih.nih.gov/health/melatonin-what-you-need-to-know)
- [NIH ODS: спортивная работоспособность](https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-HealthProfessional/)
- [ACE Exercise Library](https://www.acefitness.org/resources/everyone/exercise-library/)
- [NSCA: Romanian deadlift](https://www.nsca.com/education/articles/kinetic-select/romanian-deadlift-rdl/)
- [NSCA: glute-ham raise](https://www.nsca.com/education/articles/kinetic-select/glute-ham-raise/)

Клинические утверждения привязаны к показаниям и ограничениям, без автоматического назначения дозировок. Иконка личных данных взята из существующего Lucide (ISC), копия лицензии: public/fonts/experimental/Lucide-LICENSE.txt.

## Иллюстрации и воспроизводимость

Изображения созданы встроенным ImageGen в этой задаче. В таблице перечислены опубликованные файлы. Ниже сохранены записанные промпты финальных исходников. Перекодирование WebP выполняет scripts/build-physis-exercise-assets.py, без преобразования поз. Для сисси-приседания отдельно упакованы мужская и женская строки, границы колонок 0/496/1008/1536; фазы не дорисовываются кодом.

| Упражнение | Атлас | Превью | Фазы |
|---|---|---|---|
| nordic-curl | public/physis-art/exercises/nordic-curl-human-v2.webp | public/physis-art/exercises/nordic-curl-poster-human-v2.webp | 3 |
| sissy-machine-squat | public/physis-art/exercises/sissy-machine-squat-human-v2.webp | public/physis-art/exercises/sissy-machine-squat-poster-human-v2.webp | 3 |
| sumo-deadlift | public/physis-art/exercises/sumo-deadlift-human-v2.webp | public/physis-art/exercises/sumo-deadlift-poster-human-v2.webp | 3 |
| single-leg-rdl-one-dumbbell | public/physis-art/exercises/single-leg-rdl-one-dumbbell-human-v2.webp | public/physis-art/exercises/single-leg-rdl-one-dumbbell-poster-human-v2.webp | 3 |
| back-extension | public/physis-art/exercises/back-extension-human-v2.webp | public/physis-art/exercises/back-extension-poster-human-v2.webp | 2 |
| reverse-hyper-machine | public/physis-art/exercises/reverse-hyper-machine-human-v2.webp | public/physis-art/exercises/reverse-hyper-machine-poster-human-v2.webp | 3 |
| reverse-hyper-plate | public/physis-art/exercises/reverse-hyper-plate-human-v1.webp | public/physis-art/exercises/reverse-hyper-plate-poster-human-v1.webp | 3 |
| standing-calf-kettlebell | public/physis-art/exercises/standing-calf-kettlebell-human-v2.webp | public/physis-art/exercises/standing-calf-kettlebell-poster-human-v2.webp | 3 |
| standing-calf-smith | public/physis-art/exercises/standing-calf-smith-human-v1.webp | public/physis-art/exercises/standing-calf-smith-poster-human-v1.webp | 3 |
| standing-calf-machine | public/physis-art/exercises/standing-calf-machine-human-v2.webp | public/physis-art/exercises/standing-calf-machine-poster-human-v2.webp | 3 |
| seated-calf-barbell | public/physis-art/exercises/seated-calf-barbell-human-v2.webp | public/physis-art/exercises/seated-calf-barbell-poster-human-v2.webp | 3 |
| smith-squat | public/physis-art/exercises/smith-squat-human-v2.webp | public/physis-art/exercises/smith-squat-poster-human-v2.webp | 3 |
| pullover-plate | public/physis-art/exercises/pullover-plate-human-v2.webp | public/physis-art/exercises/pullover-plate-poster-human-v2.webp | 3 |
| pec-deck | public/physis-art/exercises/pec-deck-human-v2.webp | public/physis-art/exercises/pec-deck-poster-human-v2.webp | 2 |
| crossover-low | public/physis-art/exercises/crossover-low-human-v2.webp | public/physis-art/exercises/crossover-low-poster-human-v2.webp | 3 |
| stepup | public/physis-art/exercises/stepup-human-v2.webp | public/physis-art/exercises/stepup-poster-human-v2.webp | 3 |

### nordic-curl

```text
Create a scientific educational GENESIS exercise animation atlas,1536x1024, EXACTLY3 equal columns x2 equal rows. Man across TOP row; woman across BOTTOM row. Each row shows the SAME person doing consecutive movement phases, fixed side camera and scale, fixed apparatus and floor positions. Real muscular adult humans, skin not stone, dark forest-green/gold-trim shorts, woman sports bra, realistic textbook-quality studio illustration on #10251d green background. Soft red anatomical working-muscle overlay, no text, no labels, no borders. Six complete full-body views, all body parts and equipment fully within own cell and margins. Consistent equipment construction and connectivity.
Image1 is a POSE/MECHANICS REFERENCE ONLY, including correct contact points, joint positions and motion; remove all of its text, annotations and lines. Image2 is STYLE and CLOTHING reference ONLY from the GENESIS app; do not copy its erroneous poses. Create a new complete3-columns by2-rows atlas of these corrected poses: muscular MAN across TOP row and athletic WOMAN across BOTTOM row, all three poses repeated for both people. Forest-green/gold sports clothing, #10251d dark green studio background, red working-muscle overlays matching style image. EXACT same pose mechanics from image1. No text, no numbers, no labels, no diagrams, no arrows, no borders. Whole body fully in each cell, with generous margins including above heads, and equipment never crosses cell boundaries.
Both knees stay planted on the floor mat at the same place, ankle anchor fixed. Straight body pivots from knees, upright start and controlled assisted descent; no pushup plank.
```

### sissy-machine-squat

```text
Create a scientific educational GENESIS exercise animation atlas,1536x1024, EXACTLY3 equal columns x2 equal rows. Man across TOP row; woman across BOTTOM row. Each row shows the SAME person doing consecutive movement phases, fixed side camera and scale, fixed apparatus and floor positions. Real muscular adult humans, skin not stone, dark forest-green/gold-trim shorts, woman sports bra, realistic textbook-quality studio illustration on #10251d green background. Soft red anatomical working-muscle overlay, no text, no labels, no borders. Six complete full-body views, all body parts and equipment fully within own cell and margins. Consistent equipment construction and connectivity. Keep at least30px headroom and footroom in every cell; no cropped heads. Use reference ONLY for the CORRECT joint and calf-support positions. Redraw it in GENESIS style with man in top row and woman in bottom row. Delete all text and diagram marks. KEEP its correct squat: calf pad is LOW behind calves, well BELOW knees, never behind thighs or buttocks; shins vertical held fixed, ankles against low front roller. Start standing, middle half squat, final thighs HORIZONTAL with buttocks well BEHIND the calf pad, upper torso VERTICAL perpendicular to floor. Final buttocks far away from rear calf pad with obvious visible air gap. The rear calf pad is lower than horizontal thighs and entirely in front of the sitting-in-air hips. No seat. No buttocks on pad. No backward leaning upper body. Same pose shown clearly for BOTH man and woman.
Final correction: literal packaging of two separately generated, pose-preserving male/female rows. No pose transformation during encoding.
```

### sumo-deadlift

```text
Create a scientific educational GENESIS exercise animation atlas,1536x1024, EXACTLY3 equal columns x2 equal rows. Man across TOP row; woman across BOTTOM row. Each row shows the SAME person doing consecutive movement phases, fixed side camera and scale, fixed apparatus and floor positions. Real muscular adult humans, skin not stone, dark forest-green/gold-trim shorts, woman sports bra, realistic textbook-quality studio illustration on #10251d green background. Soft red anatomical working-muscle overlay, no text, no labels, no borders. Six complete full-body views, all body parts and equipment fully within own cell and margins. Consistent equipment construction and connectivity. Keep at least30px headroom and footroom in every cell; no cropped heads. Reference is correct SUMO DEADLIFT POSE and foot-placement guide. Keep its EXACT foot spacing and foot orientations in all three phases, do not change poses. Redraw on DARK GREEN background, add WOMAN row under MAN row performing same3 phases. Both rows forestgreen shorts and goldtrim, woman's sportsbra, main red quads/innerthigh/glutes. SAME WIDE STANCE for floorstart,midlift and fullstanding. Fixed scale and fixed floor/shoe coordinates. Shoes MUST NOT slide inward at lockout. THREE columns TWO rows, NO text/borders.
```

### single-leg-rdl-one-dumbbell

```text
Use case: scientific-educational. Edit target: the supplied GENESIS exercise movement atlas. Create a corrected publication-ready 1536x1024 landscape exercise sprite sheet, exactly THREE equal columns (512px each) and TWO equal rows (512px each), no text, no labels, no arrows, no borders. Row 1 same muscular adult man in all three cells; row 2 same athletic muscular adult woman in all three cells. Realistic human skin, NOT statues; forest green shorts and woman's sports top with restrained antique gold trim, dark green studio background #10251d. Preserve the reference's character styling, light and muscle-highlight look. Show main working muscles as subtle reddish anatomical overlay, not wounds. Each of six cells must fully contain the person and entire apparatus with margins. Fixed side camera, fixed scale and floor level, consistent body identity and equipment in every cell. Do not mirror or change the facing direction between phases.
Correction: single-leg Romanian deadlift with ONE dumbbell, consistent side view facing RIGHT in ALL SIX cells INCLUDING column1. Never rotate the standing pose to face LEFT. Same supporting RIGHT foot at same floor point, same LEFT hand holding single dumbbell throughout (contralateral loading); free LEFT leg always moves backwards towards LEFT as torso hinges forward to RIGHT. Dumbbell arm hangs vertically by gravity in every phase. Right free arm can extend sideways for balance.
Column1 tall upright standing on the RIGHT leg, soft right knee, left foot just hovering BEHIND the right heel (to the LEFT), face looks RIGHT, no high knee drive. Dumbbell in left hand beside thigh.
Column2 hip hinge halfway: hips back, torso inclines45deg to right, left leg extends backwards to left; planted right foot unchanged.
Column3 hip hinge near horizontal knee-hip-shoulder line with left leg extended straight backward to left, chest faces down; right knee remains slightly flexed, left arm holding dumbbell hangs vertically near planted shin. Hips square to floor, spine neutral. Keep same face/facing direction, shoe direction, right support leg and left hand across all three phases; no switching legs or hands. Red overlay glutes and posterior supporting thigh. No extra dumbbells.
```

### back-extension

```text
Use case: scientific-educational. Correct a GENESIS movement atlas. Reference is style and identity input only; repair incorrect poses. Output1536x1024. EXACT grid of3 equal512px columns and2 equal512px rows unless explicitly specified otherwise. Top row same adult muscular human man, bottom row same adult athletic muscular human woman. Dark green #10251d studio floor and backdrop, realistic skin, forest-green sportswear with restrained antique-gold trim. Subtle red overlay over working muscles. No text, no borders, no arrows. Fixed camera, fixed scale, whole person and equipment fit inside every cell with margins. Equipment, feet and contact points consistent across phases. OVERRIDE GRID: exactly TWO equal768px columns by TWO equal512px rows, FOUR cells total, no third phase. Man top row, woman bottom row.45-degree back extension on identical Roman chair. Side view facing RIGHT, feet secured at lower left, pelvis on inclined pad near center. Pad ends BELOW hip crease so hips hinge freely.
LEFT column LOWER: hinge torso DOWNWARD from hips, torso about30degrees below horizontal, neutral spine, head in line with trunk, hands across chest. Feet firmly secured, knees soft.
RIGHT column UPPER: straighten hips until head, trunk, hips, legs form ONE STRAIGHT DIAGONAL LINE about45deg above horizontal. STOP AT THAT STRAIGHT LINE. No lumbar hyperextension, no lifting chest or head above line of legs. Hands across chest. Same exact machine and foot placement. Red glutes/hamstrings with restrained erector overlay. Important: BOTH endpoint positions only, true45deg straight lockout, no overarched back.
```

### reverse-hyper-machine

```text
Create a scientific educational GENESIS exercise animation atlas,1536x1024, EXACTLY3 equal columns x2 equal rows. Man across TOP row; woman across BOTTOM row. Each row shows the SAME person doing consecutive movement phases, fixed side camera and scale, fixed apparatus and floor positions. Real muscular adult humans, skin not stone, dark forest-green/gold-trim shorts, woman sports bra, realistic textbook-quality studio illustration on #10251d green background. Soft red anatomical working-muscle overlay, no text, no labels, no borders. Six complete full-body views, all body parts and equipment fully within own cell and margins. Consistent equipment construction and connectivity. TRUE plate-loaded REVERSE HYPEREXTENSION MACHINE, anatomically and mechanically correct like a Rogue/Westside reverse hyper. Person prone face LEFT on a high horizontal padded table, hips over RIGHT edge, hands on front handles at LEFT. A steel pendulum swing-arm is attached to a visible real axle bearing just under the table at hip end. Swing arm extends DOWN from axle in column1, DIAGONALLY DOWN-RIGHT in column2 and NEAR-HORIZONTALLY RIGHT in column3. At DISTAL END of that SAME arm is a lateral plate-loading horn with a small secured black weight plate and collar; ankle strap links BOTH ankles to distal end. Show the whole continuous rigid arm, pivot and ankle-strap connection in every phase. Arm and plate travel TOGETHER as legs lift; NO chain, NO independent floating plate, NO separate hanging unmoving load under torso. Frame stays fixed.
Column1 legs hang nearly vertically from hips and ankle strap pulls distal arm end downward; column2 legs halfway backwards; column3 legs lifted only to trunk level, strap remains connected to pendulum. Trunk never leaves pad, knees soft, neutral neck/back. Red glutes and hamstrings. Machine visibly has a real coherent swing mechanism, not a bench with disconnected weights.
```

### reverse-hyper-plate

```text
Create a scientific educational GENESIS exercise animation atlas,1536x1024, EXACTLY3 equal columns x2 equal rows. Man across TOP row; woman across BOTTOM row. Each row shows the SAME person doing consecutive movement phases, fixed side camera and scale, fixed apparatus and floor positions. Real muscular adult humans, skin not stone, dark forest-green/gold-trim shorts, woman sports bra, realistic textbook-quality studio illustration on #10251d green background. Soft red anatomical working-muscle overlay, no text, no labels, no borders. Six complete full-body views, all body parts and equipment fully within own cell and margins. Consistent equipment construction and connectivity. Reverse hyperextension on stable high horizontal BENCH with a SINGLE small weight PLATE securely strapped directly to BOTH ANKLES using purpose-built padded ankle/foot harness. Man and woman face LEFT, prone abdomen and pelvis supported, hips at RIGHT bench edge, hands hold handles at left. Trunk remains horizontal still on pad. Plate is always physically next to/between ankles, rigidly secured so it moves WITH feet, no loose hanging chain and NO plate anywhere under the bench. No pendulum apparatus.
Column1 legs down nearly vertical, plate secured against ankles near floor; column2 legs rise diagonally backwards right with SAME plate still at ankles; column3 legs reach horizontal trunk line with SAME plate attached at ankles. Slightly soft knees, lift from hips. Do not lift above trunk, no lumbar arch, no shaking. Plate does NOT disappear or transfer to bench. Main red muscles glutes and posterior thighs.
```

### standing-calf-kettlebell

```text
Create a scientific educational GENESIS exercise animation atlas,1536x1024, EXACTLY3 equal columns x2 equal rows. Man across TOP row; woman across BOTTOM row. Each row shows the SAME person doing consecutive movement phases, fixed side camera and scale, fixed apparatus and floor positions. Real muscular adult humans, skin not stone, dark forest-green/gold-trim shorts, woman sports bra, realistic textbook-quality studio illustration on #10251d green background. Soft red anatomical working-muscle overlay, no text, no labels, no borders. Six complete full-body views, all body parts and equipment fully within own cell and margins. Consistent equipment construction and connectivity. Supported standing calf raise holding ONE kettlebell at side, opposite hand on stable vertical rack post. Side camera facing RIGHT. BOTH FOREFOOT balls and toes physically rest ON TOP of the LEFT edge of a sturdy step/low bench in front of the person. Half the shoe front is clearly supported on the step; heel half projects LEFT behind edge. Show shoe sole touching the top face, NEVER an air gap between forefoot and step. Step fixed.
Column1 heels lowered clearly BELOW the horizontal step-top, ankles dorsiflexed, calf lengthened, knees almost straight, not locked. Column2 heels at step-top height, forefoot same contact. Column3 heels rise clearly ABOVE step-top, weight on forefeet at SAME exact supported position; calf shortens. Whole body moves upward by ankle motion, knees don't bend. Same step, same contact points, same hand and same kettlebell. Highlight calves red. No floating feet, no standing in air beside bench.
```

### standing-calf-smith

```text
Create a scientific educational GENESIS exercise animation atlas,1536x1024, EXACTLY3 equal columns x2 equal rows. Man across TOP row; woman across BOTTOM row. Each row shows the SAME person doing consecutive movement phases, fixed side camera and scale, fixed apparatus and floor positions. Real muscular adult humans, skin not stone, dark forest-green/gold-trim shorts, woman sports bra, realistic textbook-quality studio illustration on #10251d green background. Soft red anatomical working-muscle overlay, no text, no labels, no borders. Six complete full-body views, all body parts and equipment fully within own cell and margins. Consistent equipment construction and connectivity. Keep at least30px headroom and footroom in every cell; no cropped heads. Targeted correction SMITH standing calf raise. All first-column HEELS drop visibly25pixels BELOW TOP of platform, while toes and ballsof feet remain ON TOP of same edge. Move feet FORWARD on the step enough for FRONT HALFof each shoe to have solid support, with HEEL HALF hanging off BACK edge, no floating toes. Middle heels level, last heels raised on same support. Keep bar firmly attached to BOTH sliding carriages on guide rods, straight bar across upper back, safety stops set below bottom point, fixed frame and platform. Ensure entire heads incllastphase fit margin. No free floating bar, no flat-foot first pose. SAME3col2rowatlas.
```

### standing-calf-machine

```text
Create a scientific educational GENESIS exercise animation atlas,1536x1024, EXACTLY3 equal columns x2 equal rows. Man across TOP row; woman across BOTTOM row. Each row shows the SAME person doing consecutive movement phases, fixed side camera and scale, fixed apparatus and floor positions. Real muscular adult humans, skin not stone, dark forest-green/gold-trim shorts, woman sports bra, realistic textbook-quality studio illustration on #10251d green background. Soft red anatomical working-muscle overlay, no text, no labels, no borders. Six complete full-body views, all body parts and equipment fully within own cell and margins. Consistent equipment construction and connectivity. Keep at least30px headroom and footroom in every cell; no cropped heads. Targeted correction to this standing CALF MACHINE atlas. KEEP3cols2rows. In the FIRST COLUMN for BOTH man and woman, move rear HEELS visibly DOWN at least25pixels BELOW platform top, ankle DORSIFLEXED, sole tilts upwards from lowered heel to supported toes. Only FRONT HALF of shoes rests atop platform edge. Heel half projects BEHIND edge in air, no platform under heels. This first phase must clearly differ from neutral middle phase. Last column heels UP on toes at same supportpoint. Fixed frame, selected stack goes up, shoulder yoke moves with person. Shrink each entire scene slightly to retain generous headroom above raised final head, no cropped heads. Do not remove or change machine type.
```

### seated-calf-barbell

```text
Create a scientific educational GENESIS exercise animation atlas,1536x1024, EXACTLY3 equal columns x2 equal rows. Man across TOP row; woman across BOTTOM row. Each row shows the SAME person doing consecutive movement phases, fixed side camera and scale, fixed apparatus and floor positions. Real muscular adult humans, skin not stone, dark forest-green/gold-trim shorts, woman sports bra, realistic textbook-quality studio illustration on #10251d green background. Soft red anatomical working-muscle overlay, no text, no labels, no borders. Six complete full-body views, all body parts and equipment fully within own cell and margins. Consistent equipment construction and connectivity. Keep at least30px headroom and footroom in every cell; no cropped heads. Seated calf raise with a LONG STRAIGHT PADDED BARBELL lying ACROSS BOTH thighs just ABOVE the knees, hands holding shaft still, symmetric small black plates at BOTH bar ends. Fixed3/4 side view so the shaft and both ends visible. Seated on stablebench facing RIGHT, knees90deg. Front halves of shoes rest ON TOP of near LEFT EDGE of elevated calfstep. Heels project left BEHIND edge in air, forefeet remain physically supported.
Column1: deep but controlled dorsiflexion, HEELS30pixels BELOW the horizontal TOP of step, front shoe/toes on step, heel backs hang visibly lower than toe tips, soles angled upward toward toes. Calves lengthened. Column2: heel level with step. Column3: heels30pixels ABOVE step top, toe contact same, calves contracted. NO bouncing, knees stay bent, hips onbench. Equipment and forefoot contact absolutely fixed. Real barbell, not a pair of dumbbells. Red calves/soleus.
```

### smith-squat

```text
Create a scientific educational GENESIS exercise animation atlas,1536x1024, EXACTLY3 equal columns x2 equal rows. Man across TOP row; woman across BOTTOM row. Each row shows the SAME person doing consecutive movement phases, fixed side camera and scale, fixed apparatus and floor positions. Real muscular adult humans, skin not stone, dark forest-green/gold-trim shorts, woman sports bra, realistic textbook-quality studio illustration on #10251d green background. Soft red anatomical working-muscle overlay, no text, no labels, no borders. Six complete full-body views, all body parts and equipment fully within own cell and margins. Consistent equipment construction and connectivity. Edit this SMITH MACHINE SQUAT atlas. Preserve its six poses, adult man/woman, skin, clothing, red quadriceps highlights, apparatus design and camera. Fix the barbells: in EVERY phase the shaft must be one RIGID PERFECTLY STRAIGHT cylindrical bar extending through both hands across upper back and into BOTH sliding guide-rail carriages. Bar centerline, collars and plates must be collinear in perspective. NO curves, NO bowed grip segments, NO broken joins. The two guide rods stay vertical and parallel, fixed frame never changes shape. Both ends visibly attached to sliding sleeves. Hands grip same straight shaft. Keep stance and camera scale constant, whole head and feet in cell. Exactly3columns2rows, no text/borders.
```

### pullover-plate

```text
Create a scientific educational GENESIS exercise animation atlas,1536x1024, EXACTLY3 equal columns x2 equal rows. Man across TOP row; woman across BOTTOM row. Each row shows the SAME person doing consecutive movement phases, fixed side camera and scale, fixed apparatus and floor positions. Real muscular adult humans, skin not stone, dark forest-green/gold-trim shorts, woman sports bra, realistic textbook-quality studio illustration on #10251d green background. Soft red anatomical working-muscle overlay, no text, no labels, no borders. Six complete full-body views, all body parts and equipment fully within own cell and margins. Consistent equipment construction and connectivity. Correct PLATE PULLOVER on flat bench. Full head/back/pelvis supported, feet flat, head at LEFT, feet at RIGHT, same fixed bench in all six cells. One light plate held securely with BOTH hands through handles, arms with slight FIXED elbow bend. Shoulders move arms through arc; not triceps extension.
Col1 plate ABOVE CHEST, arms near vertical, plate plane near horizontal.
Col2 arms move diagonally behind head to LEFT, plate rotates with hands, plane becomes diagonal.
Col3 arms reach comfortably overhead towards LEFT, near parallel to floor. The plate is held VERTICAL, its flat circular face is PERPENDICULAR to FLOOR and parallel to the plane across crown of head. It is CLEARLY BEYOND and AWAY from crown, not underneath occiput, not between head and bench. There is an obvious AIR GAP between plate and head. Head stays on bench and does not use plate as pillow. Plate is in the hands at arm's length, not touching head. Both men/women identical motion. Limit range to controlled shoulder mobility; no back arch. Red lats and pectorals.
```

### pec-deck

```text
Create a scientific educational GENESIS exercise animation atlas,1536x1024, EXACTLY3 equal columns x2 equal rows. Man across TOP row; woman across BOTTOM row. Each row shows the SAME person doing consecutive movement phases, fixed side camera and scale, fixed apparatus and floor positions. Real muscular adult humans, skin not stone, dark forest-green/gold-trim shorts, woman sports bra, realistic textbook-quality studio illustration on #10251d green background. Soft red anatomical working-muscle overlay, no text, no labels, no borders. Six complete full-body views, all body parts and equipment fully within own cell and margins. Consistent equipment construction and connectivity. Keep at least30px headroom and footroom in every cell; no cropped heads. OVERRIDE GRID to TWO equal columns and TWO equal rows: MAN upper row, WOMAN lower row, FOUR cells total. PEC DECK: LEFT open arms; RIGHT arms closed together before chest. Use fixed front camera. The entire RIGID machine frame, seat, backrest, feet and head keep IDENTICAL positions, scale and perspective in LEFT and RIGHT scenes, like two photos from a locked tripod. Copy every static part of left machine unchanged into right scene, not a different angle of machine. ONLY padded moving arm levers rotate inward around upper axle. Upper SELECTED plates visibly lift above remaining lower stack in RIGHT phase, leaving gap; LEFT stack has no gap. Weight-stack guide rods stationary. No stretching/narrowing frame or shifting seat. All machine parts incltop fully fit cells. Mainred chest.
```

### crossover-low

```text
Create a scientific educational GENESIS exercise animation atlas,1536x1024, EXACTLY3 equal columns x2 equal rows. Man across TOP row; woman across BOTTOM row. Each row shows the SAME person doing consecutive movement phases, fixed side camera and scale, fixed apparatus and floor positions. Real muscular adult humans, skin not stone, dark forest-green/gold-trim shorts, woman sports bra, realistic textbook-quality studio illustration on #10251d green background. Soft red anatomical working-muscle overlay, no text, no labels, no borders. Six complete full-body views, all body parts and equipment fully within own cell and margins. Consistent equipment construction and connectivity. Correct LOW-TO-HIGH CABLE CHEST FLY. Fixed low pulleys near ankles, fixed two cable towers and foot placement. Man/woman stand stable in split stance. Soft constant elbow bend, rounded arms as if hugging a ball, no curl and no press, shoulders do not shrug.
Col1 handles low and to sides at hip level, elbows out, chest open without excessive arm extension behind torso.
Col2 sweep rounded arms upward and inward through upper chest level.
Col3 BOTH HANDS MEET IN FRONT OF FACE at EYE/FOREHEAD HEIGHT, clearly ABOVE shoulders, not at chest or chin. Arms raised diagonally upward, elbows slightly flexed, no locked elbows, trunk stays still upright. Pulleys remain LOW, cables taut connect each handle down to its own low pulley. Main red highlight upper pectorals and small anterior deltoid area. Entire head and raised hands fit with margin. No white cell borders.
```

### stepup

```text
Create a scientific educational GENESIS exercise animation atlas,1536x1024, EXACTLY3 equal columns x2 equal rows. Man across TOP row; woman across BOTTOM row. Each row shows the SAME person doing consecutive movement phases, fixed side camera and scale, fixed apparatus and floor positions. Real muscular adult humans, skin not stone, dark forest-green/gold-trim shorts, woman sports bra, realistic textbook-quality studio illustration on #10251d green background. Soft red anatomical working-muscle overlay, no text, no labels, no borders. Six complete full-body views, all body parts and equipment fully within own cell and margins. Consistent equipment construction and connectivity. Keep at least30px headroom and footroom in every cell; no cropped heads. Edit the supplied DUMBBELL STEP-UP atlas. Add TWO realistic matching dumbbells, one firmly held in EACH HAND at the sides in ALL SIX cells, without exception. The near dumbbell and farther dumbbell must each be visibly connected to fingers/palms by handles; no floating weights, no extra hands. Arms hang straight, dumbbells hang vertically under hands, stay outside legs/box, never pass through box. Preserve the correct upward step phases, same lead foot on fixed box, same box height, red quads/glutes, realistic human models and style. Same apparatus position and camera scale in every frame, keep whole heads in all cells. No text.
```

## Приёмка

- pnpm install --frozen-lockfile; pnpm lint —0 ошибок,2 прежних предупреждения next/no-img-element в Mindmap-компонентах.
- pnpm test —712/712. После уточнения обновления профиля повторно пройдены22 теста профиля и питания, ESLint изменённых компонентов и scoped strict TypeScript с app/raw.d.ts.
- pnpm build:beget —успех;99 обязательных и402 визуальных precache-ассета; крупнейший JS chunk349968bytes.
- Chromium, светлая/тёмная схема,360/390/768/1440px: баннер, личные данные, демонстрация, показатели, карточка витамина с таблицей, каталог продуктов. Скриншоты: output/playwright/movement-{hero,personal,hyper,metrics,vitamin,food}-*.png. Переполнение проверенных новых окон и таблиц не обнаружено.
-16 обновлённых демонстраций, все фазы и оба пола:92 снимка movement-after-*.png. До: movement-before-0.png…movement-before-9.png. Контактные листы: movement-atlas-review-{0,1}.jpg. Проверены загрузка атласов, одна модель после выбора пола, две фазы гиперэкстензии, пауза и reduced motion.
- Локальная изолированная API-фикстура: сохранение и reload личных данных, десятичная запятая веса, шесть целей, обновление параметров в настройках питания без reload страницы, Escape/возврат фокуса.
- Свои показатели: создание двух определений, переименование, запись измерения, скрытие/возврат одного через настройки, удаление другого и отсутствие восстановления после reload. Измерение удалённого показателя сохраняется.
- Справочники:31 карточка веществ, сохранены пять новых; нет карточки омега-3, фильтров, текста и ссылок магазинов. Проверены поиск В7/К2/В15, раздельные K1/MK-4, количество биотина30,8мкг на≈85г печени. Продукты:47 позиций в ТОП, найдены мацони/урюк/паста без добавленного сахара/органический псиллиум; абрикосовые ядра не добавлены.
- Консоль локальной браузерной сессии:0 ошибок и0 предупреждений. На production выдуманные личные данные и измерения не записываются.

Не проверены в этой итерации: Safari/Firefox, реальные iOS/Android-устройства, экранный диктор, одновременное редактирование новых полей на двух устройствах и полный браузерный обход английского интерфейса. Персональное разделение аккаунтов опирается на существующее зашифрованное хранилище и его тесты; новые определения не публикуются глобально. Иллюстрации остаются схематическими ключевыми позами, а не измерением суставных углов или активности мышц.

Миграций БД нет. SSH не использовался. Публикация — существующий deploy.yml, target Hostinger, Android=false, репозиторий Public. Подробная сверка новых списков: [physis-food-vitamins-2026-10-25.md](physis-food-vitamins-2026-10-25.md).
