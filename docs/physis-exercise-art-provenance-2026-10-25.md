# Фюзис: происхождение изображений упражнений

Дата: 25 октября 2026. Создано встроенным imagegen (32 оригинальных атласа). Это авторские учебные иллюстрации трёх фаз, не видео, не измерение мышечной активности и не подтверждение индивидуально подходящей техники.

32 атласа содержат мужчину и женщину с естественной кожей в античной спортивной палитре. Красная подсветка условно показывает основные мышцы. Все изображения просмотрены; анатомическая точность не проходила независимую экспертную валидацию.

## Общая часть промпта

Use case: scientific-educational. Asset: a movement-animation atlas for the GENESIS fitness exercise library. Create a landscape 1536x1024 canvas divided EXACTLY into THREE equal columns and TWO equal rows, six 512x512 panels WITHOUT borders/gutters/text. Top row: same adult athletic man in THREE consecutive exercise poses. Bottom row: same adult athletic woman in the identical three poses. They are LIVING HUMANS: natural warm skin tones, visible normal human skin texture, realistic muscle anatomy, natural faces, NO marble, NO stone, NO metallic bodies, NO statues. Refined realistic 3D sports-coaching illustration, classical Greek-inspired gym clothing, dark forest green #10251d plain background, subtle antique gold accents. Man in opaque fitted dark green athletic shorts; woman in opaque supportive forest green sports top and shorts, both in simple secure sports shoes. Tasteful, fully non-explicit sports depiction. Complete bodies and all equipment fit in each square with generous safe margins, fixed camera and same scale across all three frames. Three poses must have CLEARLY different joint positions to make a readable looping demonstration. Anatomically located translucent RED overlays ONLY on the specified working muscles, subtle and following muscle shapes, no halo or red joints, no extra limbs. No words, numbers, labels, arrows or watermark.

## Уточнения упражнений

К общей части добавлено соответствующее уточнение ниже. Исходные PNG хранятся локально в ignored output/generated_images; в Git публикуются WebP и параметры кадрирования. Скрипт scripts/build-physis-exercise-assets.py выполняет только извлечение постеров и кодирование, без изменения поз.

### squat

BARBELL BACK SQUAT, three-quarter side camera. Bar on upper back/trapezius below neck, held securely, small plates. Column1 standing tall; column2 midway down; column3 bottom position, thighs approximately parallel. Heels planted, whole feet stable, knees track toes, natural torso lean, neutral braced spine. Red quadriceps and gluteus maximus only.

Файл: `public/physis-art/exercises/squat-human-v1.webp`. Граница рядов: 483 px.

### press

FLAT BARBELL BENCH PRESS. Strict TRUE SIDE profile with head LEFT and feet RIGHT, horizontal flat bench inside every square. The bar is at CHEST level horizontally: x around the center of the torso, NEVER in front of the face/neck. Both hands grip the same bar slightly wider than shoulders. A short straight bar is seen end-on from side, with small round plates. Head, shoulders and buttocks supported, both feet planted, modest natural arch. Column1 elbows extended, bar vertically ABOVE LOWER-MID CHEST. Column2 halfway lowering toward chest. Column3 bar lightly reaches lower-mid chest, elbows bent near 90 degrees and forearms VERTICAL, not bent back to face. Red pectoralis major chest and softer triceps. Clear side-profile physics.

Файл: `public/physis-art/exercises/press-human-v1.webp`. Граница рядов: 512 px.

### hinge

ROMANIAN DEADLIFT with a straight barbell with small plates, three-quarter SIDE view. Start standing bar at upper thighs; midway hip hinge back; bottom bar just below knees/mid shins. Soft knee bend stays almost constant, hips travel BACK, neutral long back, arms straight, bar slides near legs. Not a squat. Red hamstrings on BACK of thighs and gluteus maximus, not kneecaps or quadriceps.

Файл: `public/physis-art/exercises/hinge-human-v1.webp`. Граница рядов: 483 px.

### row

ONE-ARM DUMBBELL ROW with bench support, SIDE/REAR three-quarter view. Left knee and left hand on bench, right foot on floor, right hand holds dumbbell, neutral near-horizontal torso with stable hips. Three phases: dumbbell hanging below shoulder with extended elbow; halfway pulling; elbow near torso, dumbbell near HIP/lower ribs. No shrug or torso twist. Red latissimus dorsi and rhomboids on BACK only; DO NOT highlight triceps.

Файл: `public/physis-art/exercises/row-human-v1.webp`. Граница рядов: 504 px.

### pushup

FLOOR PUSH-UP, fixed SIDE profile. Hands beneath/slightly wider than shoulders, toes on floor, head hips heels form a straight line, braced torso. Column1 elbows extended at top, column2 midway lowering, column3 chest near floor with elbows around45 degrees to torso. No sagging or knees on ground. Red pectoralis chest and triceps at BACK of upper arms, not forearms.

Файл: `public/physis-art/exercises/pushup-human-v1.webp`. Граница рядов: 510 px.

### pullup

ASSISTED PULL-UP on a counterweighted gym machine, three-quarter FRONT view. Compact sturdy machine, high horizontal pull-up handles, both knees supported on the SAME padded assistance platform; platform rises with the person. Grip slightly wider than shoulders. Frame1 arms extended overhead with controlled shoulders; frame2 elbows partially bend and body rises; frame3 chin approaches handle height with elbows down, no swinging. Entire machine/person fit each square. Red latissimus dorsi along outer BACK, biceps FRONT of upper arms, not red elbow joints. Keep physical machine consistent in all panels.

Файл: `public/physis-art/exercises/pullup-human-v1.webp`. Граница рядов: 512 px.

### lunge

DUMBBELL FORWARD LUNGE, strict side three-quarter view. One dumbbell in each hand at sides, arms long, stable upright torso. Frame1 split stance after a forward step, feet on two tracks; frame2 controlled halfway knee bend; frame3 both knees bent near90 degrees, front whole foot flat and knee tracks toes, rear heel raised and rear knee near ground. Same lead leg throughout; no knee collapse. Red front quadriceps and glutes, softer rear glute.

Файл: `public/physis-art/exercises/lunge-human-v1.webp`. Граница рядов: 482 px.

### plank

FOREARM PLANK, SIDE camera, forearms on floor and elbows directly beneath shoulders. Three consecutive phases: frame1 preparatory position knees on floor, forearms set; frame2 lift knees, support on forearms and toes, straight line head shoulders hips heels and neutral spine; frame3 same excellent plank alignment while breathing out, tiny subtle ribcage change, NO sagging or raised hips. Red abdominal wall and obliques on sides of torso. Whole person head to toes fits cell.

Файл: `public/physis-art/exercises/plank-human-v1.webp`. Граница рядов: 512 px.

### run

EASY RUNNING GAIT CYCLE, clear strict SIDE silhouette, three genuinely different poses. Frame1 LEFT knee leads forward with lower leg relaxed, RIGHT leg pushes behind and right toes near floor, RIGHT arm forward. Frame2 MIDSTANCE: LEFT FOOT contacting floor DIRECTLY UNDER HIP, LEFT KNEE slightly bent, RIGHT heel folded up toward back and RIGHT knee begins to swing forward, torso nearly upright. Frame3 RIGHT knee leads forward, LEFT leg pushes behind, LEFT arm forward. Opposite-leg and opposite-arm rhythm, comfortable short stride, no extreme sprint leaps. Red glutes, quadriceps and calves. Complete body safely inside panel.

Файл: `public/physis-art/exercises/run-human-v1.webp`. Граница рядов: 475 px.

### walk

NATURAL WALKING GAIT CYCLE, clear strict SIDE silhouette with three genuinely DIFFERENT poses. Frame1 long comfortable stride, LEFT leg ahead with heel just touching ground, RIGHT leg trailing with heel lifted, opposite arm swing. Frame2 PASSING POSITION: LEFT foot FLAT ON FLOOR DIRECTLY UNDER PELVIS, body vertical OVER that foot, RIGHT KNEE slightly bent and RIGHT FOOT moving FORWARD beside LEFT ANKLE, feet almost together under hips, NOT a long stride. Frame3 RIGHT leg now ahead heel touching, LEFT leg trailing with heel lifted, opposite arms. At least one foot ALWAYS contacts floor, not running. Strong visible difference between stride and passing position. Red calves and hip glute muscles subtly. Whole bodies and feet fit squares.

Файл: `public/physis-art/exercises/walk-human-v1.webp`. Граница рядов: 478 px.

### bodyweight-squat

BODYWEIGHT SQUAT, three-quarter side view. Arms extended comfortably forward; frame1 stand with feet shoulder width; frame2 halfway descent; frame3 squat with thighs near parallel or comfortable depth. Whole feet flat, knees track toes, natural torso lean, neutral back. Red quadriceps and gluteus maximus.

Файл: `public/physis-art/exercises/bodyweight-squat-human-v1.webp`. Граница рядов: 475 px.

### goblet-squat

GOBLET SQUAT, three-quarter side view. Both hands hold ONE dumbbell vertically against upper chest by its top head, elbows down. Frame1 upright, frame2 halfway descent, frame3 thighs near parallel. Whole feet planted, knees track toes, neutral braced spine, load stays near chest. Red quadriceps and gluteus maximus.

Файл: `public/physis-art/exercises/goblet-squat-human-v1.webp`. Граница рядов: 478 px.

### split-squat

STATIC SPLIT SQUAT WITH TWO DUMBBELLS, side view. Both feet remain on floor, rear heel naturally lifted, stable staggered stance and dumbbells at sides. Frame1 knees nearly extended, frame2 halfway lowering, frame3 front knee about90 degrees and rear knee near ground; front heel flat, knees track toes, upright torso. No stepping and no elevated rear foot. Red front quadriceps and glutes.

Файл: `public/physis-art/exercises/split-squat-human-v1.webp`. Граница рядов: 472 px.

### stepup

LOW BOX STEP-UP with bodyweight, strict SIDE view. A stable 25cm high box directly ahead. Frame1 left whole foot on box, right foot on floor; frame2 press through left foot, body rises with hips/knee extending and right foot lifting; frame3 stand tall on left foot atop box, right foot beside without exaggerated knee lift. Controlled level pelvis, no bounce from floor, all box edges fit panel. Red quadriceps and glutes of the leg ON THE BOX.

Файл: `public/physis-art/exercises/stepup-human-v1.webp`. Граница рядов: 486 px.

### glute-bridge

BODYWEIGHT GLUTE BRIDGE, side profile. Back on mat, arms flat at sides, knees bent feet hip-width and flat. Frame1 hips rest on floor; frame2 hips midway up; frame3 hips lifted until shoulders hips knees form one line, ribs down and no lumbar hyperextension. Head and shoulders stay on mat. Red gluteus maximus only, hamstrings softly. No bench or barbell.

Файл: `public/physis-art/exercises/glute-bridge-human-v1.webp`. Граница рядов: 512 px.

### legpress

45-DEGREE SLED LEG PRESS on a clear compact gym machine, fixed SIDE view. Back and head supported on inclined seat, feet shoulder width on SAME large high angled footplate, hands hold handles. Frame1 knees bent around90 degrees without hips curling off seat; frame2 sled halfway pushed away; frame3 knees almost extended but softly bent. Straight fixed sled rails, footplate moves away with legs, no detached feet. Red quadriceps and glutes. Entire machine fits each cell.

Файл: `public/physis-art/exercises/legpress-human-v1.webp`. Граница рядов: 512 px.

### legcurl

PRONE LYING LEG CURL machine, strict SIDE profile with head LEFT and feet RIGHT. Person lies FACE DOWN on a padded bench, hips supported, hands grip handles near head. Cylindrical padded resistance roller sits BEHIND lower legs just ABOVE HEELS, pressing onto the BACK of ankles, never onto FRONT of shins. Frame1 knees almost straight, legs extend right horizontally. Frame2 knees bend45 degrees and heels lift up, roller follows posterior ankles. Frame3 knees bent near90 degrees, heels point UP and roller remains behind ankles, hips never lift. Red hamstrings on BACK of thighs ONLY. Anatomically correct knee flexion.

Файл: `public/physis-art/exercises/legcurl-human-v1.webp`. Граница рядов: 512 px.

### legextension

SEATED LEG EXTENSION machine, strict SIDE profile with knees facing RIGHT. Back supported upright, thighs fully supported horizontal on seat, knee joint aligned with machine pivot, roller against FRONT of lower shins above ankles. Frame1 knees bent90 degrees with feet BELOW knees; frame2 legs lift to45 degree knee bend; frame3 knees nearly straight with feet pointing RIGHT, no hyperextension. Same pivot/seat, no hip lifting, red quadriceps on FRONT thighs only.

Файл: `public/physis-art/exercises/legextension-human-v1.webp`. Граница рядов: 475 px.

### calfraise

STANDING BODYWEIGHT CALF RAISE, side three-quarter full-body view, one hand lightly touching a simple support at side for balance. Feet hip-width. Frame1 heels on floor, frame2 halfway lifting heels, frame3 stand high on balls of feet without rolling ankles, knees comfortably straight. Neutral body, no bounce. Red gastrocnemius and soleus on BACK of calves only.

Файл: `public/physis-art/exercises/calfraise-human-v1.webp`. Граница рядов: 479 px.

### deadlift

CONVENTIONAL BARBELL DEADLIFT from floor, fixed SIDE three-quarter view, full body and small circular plates. Frame1 bar over midfoot on floor, shins near bar, hips above knees, shoulders just in front of bar, long neutral spine, arms straight gripping bar outside knees. Frame2 bar passes knees close to shins/thighs as knees and hips extend together. Frame3 upright lockout with hips/knees extended and bar at thighs, NO leaning back or shrug. Red glutes and posterior thigh hamstrings, quadriceps softer. No rounded back.

Файл: `public/physis-art/exercises/deadlift-human-v1.webp`. Граница рядов: 479 px.

### dumbbell-bench

FLAT DUMBBELL BENCH PRESS, fixed three-quarter SIDE view from foot end so BOTH dumbbells clearly seen. Head shoulders buttocks on flat bench, both feet planted. Frame1 two separate dumbbells at chest sides, elbows about45 degrees from torso and forearms vertical; frame2 press halfway; frame3 arms extended over chest, dumbbells stay separate, no contact. Red pectorals, softer triceps and front deltoids. All bench/person/dumbbells inside cell.

Файл: `public/physis-art/exercises/dumbbell-bench-human-v1.webp`. Граница рядов: 511 px.

### incline-bench

INCLINE DUMBBELL BENCH PRESS, 30-DEGREE inclined sturdy bench, three-quarter SIDE view. Head upper back and hips supported, feet planted. Frame1 dumbbells at upper chest sides with forearms vertical and elbows45 degrees from torso; frame2 halfway pressing; frame3 arms extended above upper chest along vertical path, no hyperextension. Bench angle stays same across frames, no overhead press seated90. Red upper pectorals, softer anterior deltoids/triceps.

Файл: `public/physis-art/exercises/incline-bench-human-v1.webp`. Граница рядов: 504 px.

### shoulderpress

SEATED DUMBBELL SHOULDER PRESS, upright bench backrest80 degrees, three-quarter FRONT view. Head torso and hips stable, both feet planted. Frame1 two separate dumbbells beside shoulders, elbows bent90 and slightly forward, forearms vertical; frame2 arms halfway press UP; frame3 arms extended above shoulders, elbows soft, no spine arch or shoulder shrug. Red anterior and lateral deltoid muscle caps, triceps secondary, NOT biceps.

Файл: `public/physis-art/exercises/shoulderpress-human-v1.webp`. Граница рядов: 512 px.

### lateralraise

STANDING DUMBBELL LATERAL RAISE, FRONT three-quarter camera. Torso upright and motionless, knees soft, two light dumbbells, elbows slightly bent and that angle stays constant. Frame1 arms by sides; frame2 arms lifted OUT TO SIDES about45 degrees; frame3 arms no higher than shoulder level, hands roughly at shoulder height, thumbs neutral/slightly up, no pouring pinky-up or shrug. Red MIDDLE/LATERAL DELTOID caps ONLY, not forearms.

Файл: `public/physis-art/exercises/lateralraise-human-v1.webp`. Граница рядов: 478 px.

### rear-delt-fly

BENT-OVER DUMBBELL REVERSE FLY, three-quarter REAR view showing upper back and backs of shoulders. Hips hinged, knees soft, neutral steady torso near horizontal, dumbbells hang below shoulders. Frame1 arms hanging together under chest; frame2 lift arms out to sides halfway; frame3 upper arms in line with shoulders, elbows softly bent and fixed, no rowing elbow bend, no torso jerks. Red POSTERIOR deltoid caps on BACK of shoulders, rhomboids between shoulder blades softly.

Файл: `public/physis-art/exercises/rear-delt-fly-human-v1.webp`. Граница рядов: 472 px.

### latpulldown

WIDE-GRIP LAT PULLDOWN TO FRONT OF CHEST, three-quarter FRONT view. Seated on compact cable machine with thighs under support pads, feet on floor, same high pulley and long bar, grip just wider than shoulders. Frame1 arms extended overhead with bar high; frame2 pull halfway with elbows moving down; frame3 bar near upper chest BELOW chin, elbows by torso. Modest fixed lean, no pull behind neck or swinging, taut vertical cable. Red latissimus dorsi along outer back/torso sides and softer biceps FRONT of upper arms.

Файл: `public/physis-art/exercises/latpulldown-human-v1.webp`. Граница рядов: 512 px.

### seatedrow

SEATED LOW-CABLE ROW with a neutral close grip, side three-quarter view. Seated on low bench with feet on stable footplates and knees softly bent. Cable runs horizontally from low pulley ahead to a short V handle held in BOTH hands. Frame1 arms extended ahead, torso upright and back neutral; frame2 elbows halfway pulling; frame3 handle reaches lower ribs, elbows pass beside torso without leaning back or shrugging. Red latissimus along back sides and rhomboids between shoulder blades, biceps softer.

Файл: `public/physis-art/exercises/seatedrow-human-v1.webp`. Граница рядов: 500 px.

### bicepscurl

STANDING SUPINATED DUMBBELL BICEPS CURL, FRONT three-quarter view. One dumbbell in each hand with PALMS FACING FORWARD then UP as elbows bend, upper arms stay beside torso and shoulders stay still. Frame1 elbows nearly extended by sides; frame2 elbows bend90 degrees; frame3 dumbbells near front of shoulders with elbows bent, wrists straight, no swinging or elbows rising. Red BICEPS on FRONT of upper arms ONLY, not triceps.

Файл: `public/physis-art/exercises/bicepscurl-human-v1.webp`. Граница рядов: 476 px.

### hammercurl

STANDING DUMBBELL HAMMER CURL, FRONT three-quarter view. One dumbbell in each hand, NEUTRAL GRIP palms face each other throughout, dumbbells VERTICAL throughout. Upper arms at sides, no body sway. Frame1 arms nearly extended; frame2 elbows90; frame3 elbows flexed with vertical dumbbells near shoulders. Red brachialis outer upper arm and brachioradialis upper outer FOREARM, softer biceps. No rotated palms-up grip.

Файл: `public/physis-art/exercises/hammercurl-human-v1.webp`. Граница рядов: 512 px.

### tricepspushdown

CABLE ROPE TRICEPS PUSHDOWN on HIGH PULLEY, fixed SIDE three-quarter view. Stand facing a compact tall cable tower, neutral braced torso with slight fixed hip hinge. Hold BOTH ends of a rope, cable taut to high pulley above/in front. Upper arms glued beside ribs with elbows stationary. Frame1 elbows bent90 hands near lower chest; frame2 elbows extend halfway; frame3 elbows nearly straight hands beside hips, rope ends gently apart. Only FOREARMS rotate down, no whole-arm swing or squat. Red TRICEPS at BACK of upper arms only.

Файл: `public/physis-art/exercises/tricepspushdown-human-v1.webp`. Граница рядов: 477 px.

### deadbug

DEAD BUG floor core exercise, strict SIDE three-quarter view with entire body on mat, head LEFT feet RIGHT. Frame1 lie on BACK, hips and knees90 degrees with shins horizontal, BOTH arms point straight up over shoulders. Frame2 slowly extend LEFT leg diagonally toward floor and RIGHT arm overhead toward LEFT beyond head, opposite right leg stays bent90 and left arm stays vertical. Frame3 return to balanced tabletop start; keep lower back gently stable against mat, ribs down, no lumbar arch, extended foot stays just above floor. Clear opposite-limb mechanics. Red abdominal wall and obliques on torso only.

Файл: `public/physis-art/exercises/deadbug-human-v1.webp`. Граница рядов: 512 px.

### birddog

BIRD DOG on all fours, strict SIDE three-quarter view facing LEFT. Frame1 hands beneath shoulders knees beneath hips, neutral flat back. Frame2 extend RIGHT arm FORWARD toward LEFT and LEFT leg BACK toward RIGHT to make one horizontal line, left hand and right knee remain on mat, pelvis level. Frame3 controlled return to all fours. No same-side arm/leg lift, no high leg or lumbar arch, whole person including reaching hand and toes inside each square. Red abdominal wall, obliques, glute of extended leg, gentle spinal erector muscles, no red spine bones.

Файл: `public/physis-art/exercises/birddog-human-v1.webp`. Граница рядов: 509 px.
