# Genesis Tasker 3.1.3 — проверка подписанных артефактов

## Candidate9: исторический source37a0b0b1, статические проверки подтверждены

Проверено `2026-10-30T14:08:51.415004+00:00`. [Workflow41060273734](https://github.com/nikitalexanderson-byte/calendar-genesis/actions/runs/41060273734) — **SUCCESS**; exact head и `source.txt`: `37a0b0b1bc72da5b98cd4da7c0ec5ff3ed25132b`. Job завершился за50m34s. `genesis-android-3.0-trial-19`, id`12983106108`, metadata ZIP digest `sha256:d1ffd7e6766a9dc664e488abbd6e73d04191a82196a0673a0e905d1683ab669f` скачан через `gh run download` в `outputs/v313/signed-candidate9/`. Историческое имя artifact не определяет actual version: APK/AAB — **3.1.3/120**. [Workflow](../../../outputs/v313/signed-candidate9-validation/workflow-run.json), [artifact](../../../outputs/v313/signed-candidate9-validation/workflow-artifacts.json).

**Candidate9 является историческим.** После freeze source9 actual Realme/API35 проверки выявили `BUG-313-015` (разная высота привычек360dp/font1.3) и `BUG-313-016` (Greek diary search lineHeight). Production fixes относятся к следующему source10; результаты static9 на них не переносятся. Статический PASS не подтверждает устройство, Google OAuth, Play acceptance или выпуск. ADB, Gradle, SSH и новый CI dispatch этим проходом не использовались; binaries не изменялись.

| Артефакт | Bytes | SHA-256 |
| --- | ---: | --- |
| `GENESIS-Android-Native-3.1.3.apk` | 199784401 | `e67075a07442e9c9785bf23219a6ad313654bd6813584bd5d085e85b3b4c86bb` |
| `GENESIS-Android-Play-3.1.3.aab` | 203841609 | `33878aa8773409022c490584567fe76f9802ac9a0c02473dd0ab7c2fe176c5e4` |

Все **11** входных файлов повторно захешированы и неизменны, APK/AAB SHA совпали с accompanying `.sha256`: [artifact-sha256.json](../../../outputs/v313/signed-candidate9-validation/artifact-sha256.json). Сетевой сбой `gh run watch` не был ошибкой CI; completed/success/exact source независимо подтверждены перед скачиванием.

### Manifest и подписи

- Actual APK и actual protobuf manifest AAB: `ru.genesis.calendar`, **3.1.3/120**, minSdk26, targetSdk37, `debuggable=false`, `testOnly=false`. Copied `play-manifest.xml` соответствует actual AAB. Permissions: APK13, AAB12; единственная разница — `REQUEST_INSTALL_PACKAGES` только в website APK. [Manifest evidence](../../../outputs/v313/signed-candidate9-validation/manifest-summary.json).
- `apksigner verify` exit0, v2=true, один signer. SHA-256 сертификатов APK/AAB `1e161d36f574b0560d808c7ee95e1abe98165b3385336d0276fb381dfd901cb8`, SHA-1 `9a28ae70b1933d86ff3a4ef931e924f81a4426bc`; соответствуют сохранённому Console signing baseline в истории ниже. Свежий Console read этим проходом не выполнялся. [APK verification](../../../outputs/v313/signed-candidate9-validation/apk-apksigner.log), [AAB keytool](../../../outputs/v313/signed-candidate9-validation/aab-keytool.log), [fingerprints](../../../outputs/v313/signed-candidate9-validation/signing-fingerprint-summary.json).
- `jarsigner -verify -verbose -certs` exit0/`jar verified.`; independent verifying `JarFile` прочитал **1574entries**, **297970259bytes**, **1571payload**, **1571signed**, **0unsigned**. Self-signed/PKIX/no-timestamp/POSIX/JarFile-vs-JarInputStream warnings сохранены; это не Console acceptance. [Payload verification](../../../outputs/v313/signed-candidate9-validation/aab-jarfile-payload-verification.log), [warnings](../../../outputs/v313/signed-candidate9-validation/jarsigner-warning-summary.json).

### Native16KB и R8/DEX

Все **16ELF/56PT_LOAD** в4ABI имеют `p_align=16384` и корректную congruence; соответствующие APK/AAB library bytes совпали. APK native ZIP entries STORED, data offsets16KB; `zipalign -c -P 16 4` exit0. Actual AAB BundleConfig — `uncompress_native_libraries.enabled=true`, **PAGE_ALIGNMENT_16K**. [Native evidence](../../../outputs/v313/signed-candidate9-validation/native-library-alignment-recheck.json), [BundleConfig](../../../outputs/v313/signed-candidate9-validation/aab-bundle-config-decoded.log). Play-generated APK/16KB runtime здесь не выполнялись.

| Variant | Defined classes | DEX | Required→actual definitions | Mapping SHA-256 |
| --- | ---: | ---: | --- | --- |
| `release` | 20807 | 2 | 75/75 | `f4237ffbc3a47c453b65941cd55e202a8b8bce1b2303d80e42c180bb39935a54` |
| `play` | 20886 | 2 | 75/75 | `c5fcb1b659a46a1ae4e6b81e1012d4e0b4df68a126017095a9a0e3660ca995df` |

Проверены72класса frozen release-class script плюс `GenesisApplication`, `MainActivity`, `ru.genesis.calendar.ui.GenesisUpdateFileProvider`. Все mapped классы есть в actual DEX class_defs; DEX SHA-1/Adler headers корректны. Debug-only test activities отсутствуют; `androidx.test.*` definitions — 0. Embedded Play mapping совпал с external `mapping-play.txt`. [Coverage](../../../outputs/v313/signed-candidate9-validation/mapping-dex-coverage.json), [embedded mapping](../../../outputs/v313/signed-candidate9-validation/aab-embedded-mapping.json). ART startup этим проходом не проверен.

### Источник и ограничения

Текущий checkout уже может включать следующий source; actual source9 immutable artifacts определяется только `source.txt` и exact workflow. Checkout diff не встраивается в скачанные binaries: [source-scope-check.json](../../../outputs/v313/signed-candidate9-validation/source-scope-check.json). **11** внешних проверочных команд — exit0; tools/helper hashes сохранены: [commands](../../../outputs/v313/signed-candidate9-validation/command-status.json), [tools](../../../outputs/v313/signed-candidate9-validation/verification-tools.json). ASCII SUBST удалён с exit0.

Не выполнены здесь: установка/update119→120/data preservation, device startup/ART,16KB runtime, cold Google OAuth/sync, Play-generated APK/provenance, Console upload/acceptance/prelaunch/reviewer login, публикация website/Play. Их root gates остаются в [release-checklist.md](release-checklist.md) и [play-reviewer-signing-gates.md](play-reviewer-signing-gates.md).

Машинный итог: [validation-summary.json](../../../outputs/v313/signed-candidate9-validation/validation-summary.json), [evidence index](../../../outputs/v313/signed-candidate9-validation/evidence-sha256.json). История candidate8/7/6/5 сохранена побайтово: [original report](../../../outputs/v313/signed-candidate9-validation/candidate8-and-history-report-preserved.md), [preservation proof](../../../outputs/v313/signed-candidate9-validation/historical-report-preservation.json).

## Candidate8: исторический source 7883c120, статические проверки подтверждены

Проверено `2026-10-30T13:06:56.016659+00:00`. [Workflow 41051277425](https://github.com/nikitalexanderson-byte/calendar-genesis/actions/runs/41051277425) — **SUCCESS**, exact head и `source.txt`: `7883c12081895eddf1431a94315cf1aebd67324e`. Артефакт `genesis-android-3.0-trial-18` скачан через `gh run download` в `outputs/v313/signed-candidate8/`. Историческое имя artifact не определяет версию: actual APK/AAB — **3.1.3 / 120**. [Workflow metadata](../../../outputs/v313/signed-candidate8-validation/workflow-run.json), [artifact metadata](../../../outputs/v313/signed-candidate8-validation/workflow-artifacts.json).

**Этот результат подтверждает статические проверки конкретных APK/AAB candidate8. Устройство, Play acceptance и публикация проходят отдельную приёмку; этим проходом они не выполнялись.** ADB, Gradle и SSH не использовались, CI не запускался и бинарники не менялись. История candidate7/6/5 ниже сохранена побайтово.

**Candidate8 не является финальным для выпуска.** После source freeze основной агент в английском интерфейсе подтвердил production defect: summary длительности сна в `TrackersScreen.kt:128` осталось на русском (`8 ч 0 мин`). Исправление локализует длительность для 14 языков и требует следующего подписанного кандидата. Статический результат candidate8 не распространяется на последующие изменения.

| Артефакт | Bytes | SHA-256 |
| --- | ---: | --- |
| `GENESIS-Android-Native-3.1.3.apk` | 199783953 | `2a7e2b91590a0cc236c9a9c29ea1876ce059d536fc7917d94988c74ba7ce1f7f` |
| `GENESIS-Android-Play-3.1.3.aab` | 203841011 | `ded6da9d60da95629608aa921bb9bbb67c90b4b20eb94f99bd9c4c2b7ff25633` |

Все **11** входных файлов повторно захешированы и не изменились; оба binary SHA совпали с `.sha256`. Хеш каждого входного файла, включая mapping/manifests/source: [artifact-sha256.json](../../../outputs/v313/signed-candidate8-validation/artifact-sha256.json).

### Manifest, подписи и native 16 KB

- Actual APK и protobuf manifest actual AAB: `ru.genesis.calendar`, **3.1.3/120**, minSdk **26**, targetSdk **37**, `debuggable=false`, `testOnly=false`. Copied `play-manifest.xml` совпал по package/version/API/flags/permissions. APK имеет 13 permissions, AAB — 12; единственная разница — `REQUEST_INSTALL_PACKAGES` только в APK. [Manifest evidence](../../../outputs/v313/signed-candidate8-validation/manifest-summary.json).
- `apksigner verify` exit 0, v2=true, один signer. APK и AAB имеют SHA-256 сертификата `1e161d36f574b0560d808c7ee95e1abe98165b3385336d0276fb381dfd901cb8` и SHA-1 `9a28ae70b1933d86ff3a4ef931e924f81a4426bc`. Fingerprints совпали с сохранёнными read-only значениями Console upload key и Play app signing key. [APK verification](../../../outputs/v313/signed-candidate8-validation/apk-apksigner.log), [AAB keytool](../../../outputs/v313/signed-candidate8-validation/aab-keytool.log), [Console snapshot](../../../outputs/v313/signed-candidate8-validation/console-signing-reviewer-summary.json).
- `jarsigner -verify -verbose -certs` exit 0, `jar verified.`. Independent verifying `JarFile` прочитал **1574** entries / **297965300** uncompressed bytes; payload **1571**, signed payload **1571**, unsigned **0**. Warning self-signed/PKIX, отсутствие timestamp, POSIX metadata и JarFile/JarInputStream ordering сохранены. Это не подтверждение приёма Play. [Jar verification](../../../outputs/v313/signed-candidate8-validation/aab-jarfile-payload-verification.log), [warning summary](../../../outputs/v313/signed-candidate8-validation/jarsigner-warning-summary.json).
- Проверены **16 ELF / 56 PT_LOAD**, 8 libraries на артефакт, 4 ABI, включая 32-bit. Machine/class соответствуют ABI; все LOAD `p_align=16384` и congruence корректны; соответствующие APK/AAB native bytes совпали. APK native entries STORED и ZIP data offsets кратны 16384; `zipalign -c -P 16 4` exit 0. Actual AAB BundleConfig: `uncompress_native_libraries.enabled=true`, **PAGE_ALIGNMENT_16K**. [Native evidence](../../../outputs/v313/signed-candidate8-validation/native-library-alignment-recheck.json), [BundleConfig](../../../outputs/v313/signed-candidate8-validation/aab-bundle-config-decoded.log). Play-generated APK и 16 KB runtime этим проходом не проверены.

### R8 и actual DEX

| Variant | Defined classes | DEX files | Required → actual class_defs | Mapping SHA-256 |
| --- | ---: | ---: | --- | --- |
| `release` | 20807 | 2 | 75/75 | `55bbb73e1cf9905db3c7313c4a8e16b9332e7dfe152e08dffa61927d22928645` |
| `play` | 20886 | 2 | 75/75 | `14fd8857eb558c08e8922fb41480b35e071496848439559548d02b2219169aa8` |

Проверены 72 класса из frozen `scripts/check-android-release-classes.sh` и `GenesisApplication`, `MainActivity`, `ru.genesis.calendar.ui.GenesisUpdateFileProvider`. Каждый mapped class присутствует в actual DEX definitions. DEX header SHA-1 и Adler checksum валидны. Debug-only `TestWorkspaceActivity`, `StoicheionGestureActivity`, `PagerTestActivity` отсутствуют в mapping/DEX; `androidx.test.*` definitions — 0. Embedded Play mapping совпал с external `mapping-play.txt`. [Coverage](../../../outputs/v313/signed-candidate8-validation/mapping-dex-coverage.json), [embedded mapping](../../../outputs/v313/signed-candidate8-validation/aab-embedded-mapping.json). ART verification и запуск MainActivity в эти проверки не входят.

### Источник и ограничения

После source freeze есть отдельные изменения release-scope; они перечислены в source-scope-check.json и в артефакты не входят. [Source scope](../../../outputs/v313/signed-candidate8-validation/source-scope-check.json). Все **11** внешних проверочных команд завершились exit 0, инструменты и helper hashes сохранены: [command-status.json](../../../outputs/v313/signed-candidate8-validation/command-status.json), [verification-tools.json](../../../outputs/v313/signed-candidate8-validation/verification-tools.json). Временный ASCII SUBST для aapt удалён с exit 0.

Независимый read-only review восьми production-файлов привязан к source 7883c120 и их blob/SHA-256: [independent-production-review.json](../../../outputs/v313/signed-candidate8-validation/independent-production-review.json). Найденная при review account/generation гонка исправлена в этом source. Новых конкретных замечаний по финальному diff не осталось; это не результат запуска тестов или устройства.

Не выполнены этим проходом: установка, update 119 → 120 и сохранность данных, startup/ART, 16 KB runtime, cold Google OAuth/синхронизация, Play-generated APK/provenance/certificate, Console acceptance/pre-launch, публичный выпуск сайта или Play. Последние Console reviewer/signing факты и непроверенные gates находятся в [play-reviewer-signing-gates.md](play-reviewer-signing-gates.md).

### Дополнительный read-only Console-срез

Основной агент отдельно передал свежие факты чтения IAB: App content — Need attention пуст, Actioned **11**; ratings Brazil **12+**, ESRB **Teen**, PEGI **Parental guidance**, USK **12**, IARC/Russia/Korea **12**. В Exact alarms выбран **Calendar**, Save и Discard отключены; форма не менялась. Наблюдаемый Alpha release — **3.1.2/119**, UI сообщал serving 14 hours ago. Предупреждения DEX optimization **0%**, deadline February 2027, edge-to-edge и deprecated APIs относятся к **119**; их нельзя приписывать 120 без фактического Play analysis. [Сводка без private header/account/Console IDs](../../../outputs/v313/signed-candidate8-validation/console-policy-readonly-qualification.json). Данный агент Console не открывал; actual reviewer login и target audience этим срезом не проверены.

Машинный итог: [validation-summary.json](../../../outputs/v313/signed-candidate8-validation/validation-summary.json). Индекс evidence: [evidence-sha256.json](../../../outputs/v313/signed-candidate8-validation/evidence-sha256.json). Исходный предыдущий отчёт: [candidate7-and-history-report-preserved.md](../../../outputs/v313/signed-candidate8-validation/candidate7-and-history-report-preserved.md).

## Candidate7: исторический source 2f32e3cb, статические проверки подтверждены

Проверено `2026-10-30T11:37:33.415960+00:00`. [Workflow 41044846018](https://github.com/nikitalexanderson-byte/calendar-genesis/actions/runs/41044846018) завершился **SUCCESS**, job `signed-trial` 11:00:12–11:27:50 UTC. Head workflow и `source.txt` совпали с `2f32e3cb3764ed4e22b4b19c92f2fb6a6a936ba1`, versionCode 120. Артефакт `genesis-android-3.0-trial-17` скачан через `gh run download` в `outputs/v313/signed-candidate7/`; его историческое имя не меняет фактическую версию **3.1.3 / 120**. [Run metadata](../../../outputs/v313/signed-candidate7-validation/workflow-run.json), [artifact metadata](../../../outputs/v313/signed-candidate7-validation/workflow-artifacts.json).

**Подтверждены статические проверки этих APK/AAB. Финальная проверка на устройстве, Play acceptance и публикация этим проходом не выполнялись.** Последующие незакоммиченные изменения Android в рабочей папке записаны отдельно и не входят в source 2f32e3cb. Candidate6 и candidate5 ниже сохранены без замены их результатов. Этот проход не запускал ADB/Gradle, не менял бинарники и не использовал SSH.

**Candidate7 не является финальным для Play.** После freeze основной агент подтвердил необходимость candidate8: дополнительная правка интерфейса и исправление подтверждённой ошибки CAS. Статический PASS candidate7 не распространяется на эти последующие изменения.

### SHA-256 входных файлов

Все 11 входных файлов захешированы до и после проверки: содержимое не изменилось. APK/AAB совпали со своими `.sha256`. [Полный индекс](../../../outputs/v313/signed-candidate7-validation/artifact-sha256.json).

| Файл | Bytes | SHA-256 |
| --- | ---: | --- |
| `apk-metadata.txt` | 5816 | `154d31805013f8f2a98f09a3117291f2756bb036682fa6f4b65f0063df12935f` |
| `GENESIS-Android-Native-3.1.3.apk` | 199783953 | `5dcd6a9e404ab0f14d8e2e1ce0ccdea43eaec8b9e56121333eeeeaa139f14311` |
| `GENESIS-Android-Native-3.1.3.apk.sha256` | 99 | `b6f316af42cacdec999aeab512366983d94d06f7c49aa3c3602993319dcf5682` |
| `GENESIS-Android-Play-3.1.3.aab` | 203834323 | `1f7aa06dc87a8784b04174740bcc5c6d0b97ec0c5db7f6e545e32a8057169b11` |
| `GENESIS-Android-Play-3.1.3.aab.sha256` | 97 | `82f6cd9c22882b00571788090531da1fa738383b92286a68938aa6f8f5f5970e` |
| `mapping-play.txt` | 75406594 | `a2a4c3a7deed701406fa296a05d8bd191298c18e146b9924fae36b2d98b57256` |
| `mapping-release.txt` | 75368149 | `5ee174688b3ea00214172277ef55f601f767bec86101ce8183e4716a4df4e225` |
| `play-manifest.xml` | 14603 | `c951dc5b302d697ec88f103db96154d0af5a83f0358299daaf02937cc0af4a6b` |
| `play-signing-certificate.txt` | 760 | `31396565fc263cc2ce9638dac41f54e1d26e9f8708c721ee6ee3e1a42a26c45f` |
| `signing-certificate.txt` | 1028 | `fdc853f0ca636de499cb880210139196e68cb5d53bc7582e0a90c35a099ea5b3` |
| `source.txt` | 119 | `d15741d6e6b1bc36eece217a181f681c6e9cfd049cb88b4f58221ac9d627a965` |

### Идентичность, подписи и release-манифесты

| Проверка | Фактический результат | Доказательство |
| --- | --- | --- |
| Package / version / API | Actual APK и protobuf manifest actual AAB: `ru.genesis.calendar`, **3.1.3 / 120**, min 26, target 37 | [manifest-summary.json](../../../outputs/v313/signed-candidate7-validation/manifest-summary.json) |
| Release flags | В обоих `debuggable=false`, `testOnly=false` | APK aapt badging/xmltree и actual AAB manifest |
| Сертификат | APK и AAB SHA-256 `1e161d36f574b0560d808c7ee95e1abe98165b3385336d0276fb381dfd901cb8`, SHA-1 `9a28ae70b1933d86ff3a4ef931e924f81a4426bc`; прежняя release identity | [fingerprints](../../../outputs/v313/signed-candidate7-validation/signing-fingerprint-summary.json), [APK apksigner](../../../outputs/v313/signed-candidate7-validation/apk-apksigner.log), [AAB keytool](../../../outputs/v313/signed-candidate7-validation/aab-keytool.log) |
| APK signature | `apksigner verify` exit 0, v2=true, один signer | Остальные схемы сохранены в raw log; им не присвоен PASS |
| AAB signature | `jarsigner -verify -verbose -certs` exit 0, `jar verified.`; verifying JarFile независимо прочитал payload | [jarsigner](../../../outputs/v313/signed-candidate7-validation/aab-jarsigner.log), [JarFile](../../../outputs/v313/signed-candidate7-validation/aab-jarfile-payload-verification.log) |
| Разрешения | APK 13, AAB 12; единственная разница — `REQUEST_INSTALL_PACKAGES` только в APK | В actual Play AAB разрешение установки пакетов отсутствует |
| Copied Play manifest | Package/version/API/flags/permissions из `play-manifest.xml` совпали с actual подписанным AAB | [decoded protobuf manifest](../../../outputs/v313/signed-candidate7-validation/aab-manifest-decoded.tsv) |

SDK Build Tools 37.0.0, JBR и cached protobuf/bundletool dependencies зафиксированы в [verification-tools.json](../../../outputs/v313/signed-candidate7-validation/verification-tools.json). Временный ASCII SUBST для aapt удалён с exit 0; исходные файлы не правились. Все **11** внешних проверочных команд завершились exit 0: [command-status.json](../../../outputs/v313/signed-candidate7-validation/command-status.json).

JDK warnings сохранены: self-signed/PKIX-chain, отсутствие timestamp, POSIX metadata и различия JarFile/JarInputStream. Actual `META-INF/MANIFEST.MF` расположен последним, index **1573** из **1574**; все имена entries уникальны. [Warning summary](../../../outputs/v313/signed-candidate7-validation/jarsigner-warning-summary.json). Это не подтверждение приёма Google Play.

Дополнительный `JarFile(path, true)` прочитал **1574** файлов / **297928645** uncompressed bytes. Все **1571** payload entries подписаны ожидаемым сертификатом; unsigned payload **0**, signature metadata **3**. [Helper](../../../outputs/v313/signed-candidate7-validation/VerifyCandidateJar.java).

### 16 KB: ELF и APK ZIP

| ABI | Native library | ELF bits | PT_LOAD | p_align каждого LOAD | APK ZIP data offset |
| --- | --- | ---: | ---: | --- | ---: |
| `arm64-v8a` | `libandroidx.graphics.path.so` | 64 | 3 | 16384, 16384, 16384 | 6438912 |
| `arm64-v8a` | `libdatastore_shared_counter.so` | 64 | 4 | 16384, 16384, 16384, 16384 | 6455296 |
| `armeabi-v7a` | `libandroidx.graphics.path.so` | 32 | 3 | 16384, 16384, 16384 | 6471680 |
| `armeabi-v7a` | `libdatastore_shared_counter.so` | 32 | 4 | 16384, 16384, 16384, 16384 | 6488064 |
| `x86` | `libandroidx.graphics.path.so` | 32 | 3 | 16384, 16384, 16384 | 6504448 |
| `x86` | `libdatastore_shared_counter.so` | 32 | 4 | 16384, 16384, 16384, 16384 | 6520832 |
| `x86_64` | `libandroidx.graphics.path.so` | 64 | 3 | 16384, 16384, 16384 | 6537216 |
| `x86_64` | `libdatastore_shared_counter.so` | 64 | 4 | 16384, 16384, 16384, 16384 | 6553600 |

В каждом артефакте 8 `.so`, 4 ABI; проверены **16 ELF / 56 PT_LOAD**. Все LOAD имеют `p_align=16384` и корректную congruence `offset % 16384 == vaddr % 16384`; ELF machine/class соответствуют ABI, включая 32-bit. Соответствующие native bytes APK/AAB идентичны по SHA-256. APK: все 8 native entries STORED, data offsets кратны 16384; `zipalign -c -P 16 4` exit 0. [Per-library evidence](../../../outputs/v313/signed-candidate7-validation/native-library-alignment-recheck.json).

В AAB native entries DEFLATED. Actual BundleConfig содержит `uncompress_native_libraries.enabled=true` и **PAGE_ALIGNMENT_16K**: [decoded config](../../../outputs/v313/signed-candidate7-validation/aab-bundle-config-decoded.log). ZIP offsets AAB не подтверждают выравнивание устанавливаемого APK. Play-generated APK и 16 KB runtime этим проходом не проверены.

### R8, DEX и отсутствие debug Activity

| Variant | Mapping bytes | Mapping SHA-256 | DEX | Defined classes | Required → actual class_defs |
| --- | ---: | --- | ---: | ---: | --- |
| `release` | 75368149 | `5ee174688b3ea00214172277ef55f601f767bec86101ce8183e4716a4df4e225` | 2 | 20795 | **75/75** |
| `play` | 75406594 | `a2a4c3a7deed701406fa296a05d8bd191298c18e146b9924fae36b2d98b57256` | 2 | 20874 | **75/75** |

В обоих variants проверены 72 класса из frozen `scripts/check-android-release-classes.sh` и `GenesisApplication`, `MainActivity`, `ru.genesis.calendar.ui.GenesisUpdateFileProvider`. Каждое имя сопоставлено через R8 с actual DEX class_def; DEX header SHA-1 и Adler checksum совпали. Debug-only `TestWorkspaceActivity`, `StoicheionGestureActivity`, `PagerTestActivity` отсутствуют и в mapping, и в actual DEX. Определений `androidx.test.*` найдено 0. R8/min_api headers сохранены: [mapping-dex-coverage.json](../../../outputs/v313/signed-candidate7-validation/mapping-dex-coverage.json). Embedded Play mapping полностью совпал с external `mapping-play.txt`: [aab-embedded-mapping.json](../../../outputs/v313/signed-candidate7-validation/aab-embedded-mapping.json).

Это статические проверки структуры DEX; ART class/method verification и запуск MainActivity на устройстве в них не входят.

### Источник и пределы candidate7

На момент статической проверки HEAD совпадал с source 2f32e3cb, но release-scope содержал последующие незакоммиченные изменения: `DiaryScreen.kt`, `HabitsScreen.kt`, `MobileWorkspaceShell.kt`, `SharedBulkState.kt`, `WorkspaceBackgroundStatus.kt`. Они не входят в APK/AAB candidate7. Полный срез: [source-scope-check.json](../../../outputs/v313/signed-candidate7-validation/source-scope-check.json).

Не выполнены этим проходом: установка, обновление 119 → 120 и сохранность данных, startup/ART, 16 KB runtime, live Google OAuth/синхронизация, Play-generated APK/app-signing certificate, Console acceptance/pre-launch report, публикация сайта или Play. Сертификат upload AAB не подменяет сертификат APK, доставляемого Play. Reviewer/signing gates и подтверждённые unknown: [play-reviewer-signing-gates.md](play-reviewer-signing-gates.md).

Машинный итог: [validation-summary.json](../../../outputs/v313/signed-candidate7-validation/validation-summary.json). Индекс evidence: [evidence-sha256.json](../../../outputs/v313/signed-candidate7-validation/evidence-sha256.json). Предыдущий отчёт целиком сохранён в [candidate6-and5-report-preserved.md](../../../outputs/v313/signed-candidate7-validation/candidate6-and5-report-preserved.md); его исходное содержимое ниже оставлено без правок.

## Candidate6: исторический source 225, статические проверки подтверждены

Проверено `2026-10-30T10:29:46.063451+00:00`. [Workflow 41034673895](https://github.com/nikitalexanderson-byte/calendar-genesis/actions/runs/41034673895) завершился **SUCCESS**; head и `source.txt` совпали с `225cf634c3545a486c50595e0344798cdb426ea6`, versionCode 120. Артефакт `genesis-android-3.0-trial-16` скачан через `gh run download` в `outputs/v313/signed-candidate6/`; историческое имя artifact не меняет фактическую версию **3.1.3 / 120**.

**Candidate6 не является финальным для Play.** После freeze 225 аппаратный проход на Realme выявил непереведённые accessibility-подписи привычки (`HabitsScreen.kt:625/636`: отметка выполнения и «Таймер привычки …»). Эти строки подтверждены и в source 225; требуется следующий кандидат с исправленной локализацией. Положительный статический результат candidate6 сохраняется для отдельной проверки подписанного обновления 119 → 120 основным агентом.

Этот проход выполнял ожидание/read-only чтение GitHub Actions, скачивание артефактов и локальные статические проверки. Он не запускал ADB/Gradle, не устанавливал APK, не публиковал сайт или Play и не менял бинарники.

### SHA-256 входных файлов

Все 11 входных файлов захешированы до и после проверки: содержимое не изменилось. APK/AAB совпали со своими `.sha256`. Полный индекс: [artifact-sha256.json](../../../outputs/v313/signed-candidate6-validation/artifact-sha256.json).

| Файл | Bytes | SHA-256 |
| --- | ---: | --- |
| `apk-metadata.txt` | 5816 | `154d31805013f8f2a98f09a3117291f2756bb036682fa6f4b65f0063df12935f` |
| `GENESIS-Android-Native-3.1.3.apk` | 199767203 | `d2fecf21ac478746a3bd4c296c4f9f7d95e15d1936d10db9a6f4acd91a9cea9f` |
| `GENESIS-Android-Native-3.1.3.apk.sha256` | 99 | `7d4b5af6e4f9c4ffd5befce1d10810239189fbcd3f36c72caa7a7a0e7c3e40bb` |
| `GENESIS-Android-Play-3.1.3.aab` | 203815277 | `344733403817b25a2e6b61341fa902a4113db8f8ae50201869bd4d05ccb0bb75` |
| `GENESIS-Android-Play-3.1.3.aab.sha256` | 97 | `7f2c6937ae7c79cb2bfb3a08f2610547d84cb45dcfa99f34244acb427329925e` |
| `mapping-play.txt` | 75405944 | `ca70a02c63ea0b7bddcd6046485b0ad213006375e874f0492af75c75a92e52f9` |
| `mapping-release.txt` | 75367499 | `d514ed26f2e4057c4d3f19621a4c34b1b6f1909343206da9a8afe10456724538` |
| `play-manifest.xml` | 14603 | `c951dc5b302d697ec88f103db96154d0af5a83f0358299daaf02937cc0af4a6b` |
| `play-signing-certificate.txt` | 760 | `31396565fc263cc2ce9638dac41f54e1d26e9f8708c721ee6ee3e1a42a26c45f` |
| `signing-certificate.txt` | 1028 | `fdc853f0ca636de499cb880210139196e68cb5d53bc7582e0a90c35a099ea5b3` |
| `source.txt` | 119 | `99e4248430b1a92f7cfc4ff1eeb38f4ecd3b3b8ef978951cba15017b23114b6f` |

### Идентичность, подписи и release-манифесты

| Проверка | Фактический результат | Доказательство |
| --- | --- | --- |
| Package / version / API | Actual APK и actual AAB: `ru.genesis.calendar`, **3.1.3 / 120**, min 26, target 37 | [manifest-summary.json](../../../outputs/v313/signed-candidate6-validation/manifest-summary.json) |
| Флаги release | В обоих `debuggable=false`, `testOnly=false` | APK aapt badging/xmltree; protobuf manifest внутри AAB |
| Сертификат | APK и AAB SHA-256 `1e161d36f574b0560d808c7ee95e1abe98165b3385336d0276fb381dfd901cb8`, прежняя release identity | [apk-apksigner.log](../../../outputs/v313/signed-candidate6-validation/apk-apksigner.log), [aab-keytool.log](../../../outputs/v313/signed-candidate6-validation/aab-keytool.log) |
| APK signature | `apksigner verify`: exit 0, v2=true, 1 signer | Другие схемы сохранены в raw log; им не присвоен PASS |
| AAB signature | `jarsigner -verify -verbose -certs`: exit 0, `jar verified.`; дополнительный verifying JarFile прочитал каждый payload | [aab-jarsigner.log](../../../outputs/v313/signed-candidate6-validation/aab-jarsigner.log), [JarFile log](../../../outputs/v313/signed-candidate6-validation/aab-jarfile-payload-verification.log) |
| Разрешения | APK 13, Play AAB 12; единственная разница — `REQUEST_INSTALL_PACKAGES`, присутствует только в APK | Actual AAB не содержит разрешение установки пакетов |
| Copied Play manifest | Package/version/API/debug/testOnly и permissions из `play-manifest.xml` совпали с actual подписанным AAB | [aab-manifest-decoded.tsv](../../../outputs/v313/signed-candidate6-validation/aab-manifest-decoded.tsv) |

AAB manifest прочитан из protobuf `base/manifest/AndroidManifest.xml`; actual `BundleConfig.pb` также декодирован. Использованы SDK Build Tools 37.0.0, JBR 25.0.3, cached aapt2-proto 9.4.0-15978811 / protobuf-java 3.25.5 / bundletool 1.18.3. Версии, SHA зависимостей и проверяющего скрипта сохранены в [verification-tools.json](../../../outputs/v313/signed-candidate6-validation/verification-tools.json). Временный ASCII SUBST для aapt удалён с exit 0; оригинальные файлы не копировались для изменения и не правились. Все 11 внешних проверочных команд завершились exit 0: [command-status.json](../../../outputs/v313/signed-candidate6-validation/command-status.json).

Предупреждения JDK не скрыты: self-signed/PKIX-chain, отсутствие timestamp, POSIX metadata и различия JarFile/JarInputStream. Actual `META-INF/MANIFEST.MF` расположен последним, index 1570 из 1571; все имена entries уникальны. Это не объявляется отсутствием предупреждений или подтверждением приёма Play.

Дополнительный `JarFile(path, true)` прочитал **1571** файлов / **297872173** uncompressed bytes. Все **1568** payload entries подписаны ожидаемым сертификатом; unsigned payload **0**, signature metadata 3. [Код helper](../../../outputs/v313/signed-candidate6-validation/VerifyCandidateJar.java) и [warning summary](../../../outputs/v313/signed-candidate6-validation/jarsigner-warning-summary.json).

### 16 KB: ELF и APK ZIP

| ABI | Native library | ELF bits | PT_LOAD | p_align каждого LOAD | APK ZIP data offset |
| --- | --- | ---: | ---: | --- | ---: |
| `arm64-v8a` | `libandroidx.graphics.path.so` | 64 | 3 | 16384, 16384, 16384 | 6438912 |
| `arm64-v8a` | `libdatastore_shared_counter.so` | 64 | 4 | 16384, 16384, 16384, 16384 | 6455296 |
| `armeabi-v7a` | `libandroidx.graphics.path.so` | 32 | 3 | 16384, 16384, 16384 | 6471680 |
| `armeabi-v7a` | `libdatastore_shared_counter.so` | 32 | 4 | 16384, 16384, 16384, 16384 | 6488064 |
| `x86` | `libandroidx.graphics.path.so` | 32 | 3 | 16384, 16384, 16384 | 6504448 |
| `x86` | `libdatastore_shared_counter.so` | 32 | 4 | 16384, 16384, 16384, 16384 | 6520832 |
| `x86_64` | `libandroidx.graphics.path.so` | 64 | 3 | 16384, 16384, 16384 | 6537216 |
| `x86_64` | `libdatastore_shared_counter.so` | 64 | 4 | 16384, 16384, 16384, 16384 | 6553600 |

В каждом артефакте 8 `.so`, 4 ABI; проверены **16 ELF / 56 PT_LOAD**. Все LOAD имеют `p_align=16384` и корректную congruence `offset % 16384 == vaddr % 16384`; ELF machine/class соответствуют каждому ABI, включая 32-bit. Соответствующие native bytes APK/AAB идентичны по SHA-256. APK: все 8 native entries STORED и их ZIP data offsets кратны 16384; `zipalign -c -P 16 4` exit 0. [Per-library evidence](../../../outputs/v313/signed-candidate6-validation/native-library-alignment-recheck.json).

В AAB native entries DEFLATED; ZIP offsets самого bundle не равны выравниванию устанавливаемого APK. Actual BundleConfig содержит `uncompress_native_libraries.enabled=true` и **PAGE_ALIGNMENT_16K**: [decoded config](../../../outputs/v313/signed-candidate6-validation/aab-bundle-config-decoded.log). Установленные Play APK и 16 KB runtime здесь не проверялись.

### R8, DEX и отсутствие debug Activity

| Variant | Mapping bytes | Mapping SHA-256 | R8 / min_api | DEX | Defined classes | Required → actual class_defs |
| --- | ---: | --- | --- | ---: | ---: | --- |
| `release` | 75367499 | `d514ed26f2e4057c4d3f19621a4c34b1b6f1909343206da9a8afe10456724538` | 9.4.14 / 26 | 2 | 20795 | **75/75** |
| `play` | 75405944 | `ca70a02c63ea0b7bddcd6046485b0ad213006375e874f0492af75c75a92e52f9` | 9.4.14 / 26 | 2 | 20874 | **75/75** |

Проверены 72 класса из frozen `scripts/check-android-release-classes.sh` и `GenesisApplication`, `MainActivity`, **`ru.genesis.calendar.ui.GenesisUpdateFileProvider`**. Каждое имя сопоставлено через R8 с actual DEX class_def; контрольные суммы и SHA-1 signature DEX headers также совпали. В обоих variants отсутствуют debug-only `TestWorkspaceActivity`, `StoicheionGestureActivity`, `PagerTestActivity` и в mapping, и в определениях DEX; определений `androidx.test.*` найдено 0. [mapping-dex-coverage.json](../../../outputs/v313/signed-candidate6-validation/mapping-dex-coverage.json).

Embedded Play mapping полностью совпал с external `mapping-play.txt`: **75405944 bytes**, SHA-256 `ca70a02c63ea0b7bddcd6046485b0ad213006375e874f0492af75c75a92e52f9`. [aab-embedded-mapping.json](../../../outputs/v313/signed-candidate6-validation/aab-embedded-mapping.json).

Первая попытка нового helper ошибочно ожидала FileProvider в корневом namespace `ru.genesis.calendar`. Имя исправлено по предыдущему независимому runbook на `.ui.GenesisUpdateFileProvider`; повтор завершился 75/75 в обоих variants. Начальная частичная диагностика сохранена в [helper-correction.json](../../../outputs/v313/signed-candidate6-validation/helper-correction.json) и [initial coverage](../../../outputs/v313/signed-candidate6-validation/mapping-dex-coverage-initial-helper-error.json). Это исправление проверки; бинарники не менялись.

Это статические проверки классов и структуры DEX. Они не заменяют ART class/method verification и запуск MainActivity на устройстве.

### Источник и пределы candidate6

Во время проверки HEAD оставался `225cf634c3545a486c50595e0344798cdb426ea6`, но рабочая папка уже содержала последующие Android/localization и web/legal изменения. Полный release-scope diff/status записан в [source-scope-check.json](../../../outputs/v313/signed-candidate6-validation/source-scope-check.json). Они не входят в подписанный source 225 и не объявляются покрытыми этим APK/AAB.

Не выполнены этим проходом: install, обновление 119 → 120 и сохранность данных после него, startup/ART, 16 KB runtime, live Google OAuth/синхронизация, Play-generated APK/app-signing certificate, Console acceptance/pre-launch report, публикация сайта/Play. Сертификат AAB upload не подменяет сертификат APK, доставляемого Play.

Машинный итог: [validation-summary.json](../../../outputs/v313/signed-candidate6-validation/validation-summary.json). Хеши всех evidence files: [evidence-sha256.json](../../../outputs/v313/signed-candidate6-validation/evidence-sha256.json). История candidate5 ниже сохранена отдельно; её SHA и результаты не заменены значениями candidate6.

## История: signed candidate5 — source597f38e8

Проверено `2026-10-30T08:47:37.806891+00:00`. Входные файлы: `outputs/v313/signed-candidate5/`, ранее скачанные root из [workflow 41017909881](https://github.com/nikitalexanderson-byte/calendar-genesis/actions/runs/41017909881). `source.txt` указывает `597f38e8e9b4912470a0ab9fc96a01a7ebeeead5`, branch `codex/v3.1.3-today-trackers`, versionCode 120. Успех workflow передан root; этот проход не запускал и не публиковал CI.

**Статические проверки конкретных APK/AAB подтверждены. Установка, запуск на устройстве и приём Google Play этим отчётом не подтверждаются.** ADB, Gradle, CI, install, публикация и изменение самих артефактов не выполнялись.

### SHA-256 каждого входного файла

Два вычисленных SHA APK/AAB совпали с соответствующими `.sha256`. После проверки все 11 файлов повторно захешированы: содержимое не изменилось. Полный индекс: [artifact-sha256.json](../../../outputs/v313/signed-candidate5-validation/artifact-sha256.json).

| Файл | Bytes | SHA-256 |
| --- | ---: | --- |
| `apk-metadata.txt` | 5816 | `154d31805013f8f2a98f09a3117291f2756bb036682fa6f4b65f0063df12935f` |
| `GENESIS-Android-Native-3.1.3.apk` | 199767203 | `d5f4bbc39f9bee9384b5c1946cd2b2cb90b80632784b0aa6518f21d941318185` |
| `GENESIS-Android-Native-3.1.3.apk.sha256` | 99 | `4cfbdce764b57086a2fd0abbb86829a72f1ef2bfbd2fbb1f5cb1d2d5f6662f28` |
| `GENESIS-Android-Play-3.1.3.aab` | 203814766 | `7e65a80aa93cdd60d66749007c878e748832c80023adfd7d56a2c68fc26cabcc` |
| `GENESIS-Android-Play-3.1.3.aab.sha256` | 97 | `06f667e651202ef2adcadff07b87791480b3059a7849f3a02fd917c486034e8b` |
| `mapping-play.txt` | 75404111 | `f3bd4d74fb304a878f3b188da7ea22cf4e87e342a8891b42ff23383847b5979b` |
| `mapping-release.txt` | 75365666 | `e0482fa0b68131326d18327f01a9a1120d978d5a1398154e42be7898767cbbde` |
| `play-manifest.xml` | 14603 | `c951dc5b302d697ec88f103db96154d0af5a83f0358299daaf02937cc0af4a6b` |
| `play-signing-certificate.txt` | 760 | `31396565fc263cc2ce9638dac41f54e1d26e9f8708c721ee6ee3e1a42a26c45f` |
| `signing-certificate.txt` | 1028 | `fdc853f0ca636de499cb880210139196e68cb5d53bc7582e0a90c35a099ea5b3` |
| `source.txt` | 119 | `df14e7d90e7beaec658bb4b8e46c61e1258504c5841e9f0ef8ee87e6a9d05819` |

### Идентичность, manifest и подпись

| Проверка | Фактический результат | Доказательство |
| --- | --- | --- |
| Package / version | В APK и **actual AAB manifest**: `ru.genesis.calendar`, `3.1.3 / 120` | [manifest-summary.json](../../../outputs/v313/signed-candidate5-validation/manifest-summary.json) |
| Android API / debug | В обоих min 26, target 37, `debuggable=false`; Play не `testOnly` | APK через aapt, AAB из подписанного protobuf manifest |
| Сертификат | APK и AAB: SHA-256 `1e161d36f574b0560d808c7ee95e1abe98165b3385336d0276fb381dfd901cb8`, прежняя release identity; SHA-1 `9a28ae70b1933d86ff3a4ef931e924f81a4426bc` | [apk-apksigner.log](../../../outputs/v313/signed-candidate5-validation/apk-apksigner.log), [aab-keytool.log](../../../outputs/v313/signed-candidate5-validation/aab-keytool.log) |
| APK signature | `apksigner verify --verbose --print-certs`, exit 0; APK Signature Scheme v2=true, 1 signer | Другие схемы перечислены в raw log, не переименованы в пройденные |
| AAB signature | `jarsigner -verify`, exit 0, `jar verified.`; дополнительно все 1568 payload entries проверены verifying `JarFile`, unsigned payload=0, только ожидаемый signer | [aab-jarsigner.log](../../../outputs/v313/signed-candidate5-validation/aab-jarsigner.log), [aab-jarfile-payload-verification.log](../../../outputs/v313/signed-candidate5-validation/aab-jarfile-payload-verification.log) |
| Разрешения site / Play | APK содержит `REQUEST_INSTALL_PACKAGES` для прямого канала. Actual AAB его **не содержит**. Это единственная разница списков permissions | [manifest-summary.json](../../../outputs/v313/signed-candidate5-validation/manifest-summary.json); 13 permissions APK / 12 permissions Play |
| Play manifest из CI | Поля package/version/API/debug и список permissions скопированного `play-manifest.xml` совпали с independently decoded manifest внутри подписанного AAB | [aab-manifest-decoded.tsv](../../../outputs/v313/signed-candidate5-validation/aab-manifest-decoded.tsv), [aab-decode-status.json](../../../outputs/v313/signed-candidate5-validation/aab-decode-status.json) |

AAB manifest декодирован из `base/manifest/AndroidManifest.xml` через локальные `aapt2-proto 9.4.0-15978811` + `protobuf-java 3.25.5`; BundleConfig — через bundled schema `bundletool 1.18.3`. Прочитаны реальные protobuf bytes, а не только текстовый manifest из CI. SDK Build Tools 37.0.0 и JBR 25.0.3; helpers и их вывод сохранены в validation directory.

Первый aapt вызов с абсолютным кириллическим путём завершился exit 1: Windows ziparchive `Illegal byte sequence`. Эти логи сохранены. Повтор через временный ASCII SUBST `X:` завершился exit 0 для badging и xmltree; alias удалён (exit 0), исходный APK не копировался и не изменялся. Это исправление способа доступа к файлу, а не замена неуспешной проверки другой сборкой. Доказательства: [apk-command-status.json](../../../outputs/v313/signed-candidate5-validation/apk-command-status.json), [apk-ascii-command-status.json](../../../outputs/v313/signed-candidate5-validation/apk-ascii-command-status.json), [apk-badging-ascii.log](../../../outputs/v313/signed-candidate5-validation/apk-badging-ascii.log), [apk-manifest-xmltree-ascii.log](../../../outputs/v313/signed-candidate5-validation/apk-manifest-xmltree-ascii.log).

#### Предупреждения JDK 25 при AAB verification

Raw jarsigner log содержит self-signed/PKIX-chain и отсутствие timestamp, POSIX/ZIP metadata, а также расхождения `JarFile` / `JarInputStream`: `META-INF/MANIFEST.MF` находится последним, entry index 1570 из 1571. Все имена ZIP entries уникальны. Предупреждения не скрыты и не названы отсутствующими.

Дополнительное чтение через `new JarFile(path, true)` проверило подпись при чтении всех 1571 файла: 1568 payload entries подписаны единственным ожидаемым сертификатом; 3 служебных signature metadata entries исключены из payload count. Прочитано 297869940 uncompressed bytes; unsigned payload 0; exit 0. Это подтверждение JarFile verification, а не обещание совместимости любого streaming reader или решение Play Console. Код проверки: [VerifyCandidateJar.java](../../../outputs/v313/signed-candidate5-validation/VerifyCandidateJar.java).

### 16 KB: ZIP, ELF и все ABI

| ABI | Native library | ELF bits | PT_LOAD | p_align каждого LOAD | APK ZIP data offset |
| --- | --- | ---: | ---: | --- | ---: |
| `arm64-v8a` | `libandroidx.graphics.path.so` | 64 | 3 | `16384, 16384, 16384` | 6438912 |
| `arm64-v8a` | `libdatastore_shared_counter.so` | 64 | 4 | `16384, 16384, 16384, 16384` | 6455296 |
| `armeabi-v7a` | `libandroidx.graphics.path.so` | 32 | 3 | `16384, 16384, 16384` | 6471680 |
| `armeabi-v7a` | `libdatastore_shared_counter.so` | 32 | 4 | `16384, 16384, 16384, 16384` | 6488064 |
| `x86` | `libandroidx.graphics.path.so` | 32 | 3 | `16384, 16384, 16384` | 6504448 |
| `x86` | `libdatastore_shared_counter.so` | 32 | 4 | `16384, 16384, 16384, 16384` | 6520832 |
| `x86_64` | `libandroidx.graphics.path.so` | 64 | 3 | `16384, 16384, 16384` | 6537216 |
| `x86_64` | `libdatastore_shared_counter.so` | 64 | 4 | `16384, 16384, 16384, 16384` | 6553600 |

В каждом артефакте 8 библиотек, 4 ABI; всего проверено 16 ELF files / 56 PT_LOAD segments. Для всех, включая 32-bit ABI, `p_align=16384`, а `p_offset % 16384 == p_vaddr % 16384`; ELF machine/class соответствуют ABI. Соответствующие native bytes APK/AAB идентичны по SHA-256. Полные per-library SHA и program headers: [native-library-alignment-recheck.json](../../../outputs/v313/signed-candidate5-validation/native-library-alignment-recheck.json). Parser с явными ELF32/ELF64 offsets: [verify-native-alignment.py](../../../outputs/v313/signed-candidate5-validation/verify-native-alignment.py).

APK: все 8 native entries STORED/uncompressed и их ZIP data offsets кратны 16384; SDK `zipalign -c -P 16 4` завершился exit 0. [apk-zipalign16.log](../../../outputs/v313/signed-candidate5-validation/apk-zipalign16.log).

AAB: native entries DEFLATED, поэтому выравнивание ZIP offsets самого bundle не является выравниванием устанавливаемого APK. Actual `BundleConfig.pb`: `uncompress_native_libraries.enabled=true`, `PAGE_ALIGNMENT_16K`. [aab-bundle-config-decoded.log](../../../outputs/v313/signed-candidate5-validation/aab-bundle-config-decoded.log). Проверка фактически созданных Play APK и запуск в 16 KB среде остаются отдельными runtime gates.

### R8 mapping и статическое наличие startup-классов

| Variant | Mapping bytes | Compiler / min_api | DEX files | Defined classes | Required mappings → DEX definitions |
| --- | ---: | --- | ---: | ---: | --- |
| `release` | 75365666 | R8 `9.4.14` / 26 | 2 | 20795 | **75/75** |
| `play` | 75404111 | R8 `9.4.14` / 26 | 2 | 20874 | **75/75** |

Список включает 72 обязательных surface/journal/protocol классов из `scripts/check-android-release-classes.sh` и `GenesisApplication`, `MainActivity`, `GenesisUpdateFileProvider`. Для каждого найдено точное R8 переименование и actual `class_def` в DEX соответствующего APK или AAB, без подмены наличием текстовой ссылки. Результаты со всеми именами: [mapping-dex-coverage.json](../../../outputs/v313/signed-candidate5-validation/mapping-dex-coverage.json).

Embedded `BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map` в AAB совпадает с `mapping-play.txt`: 75404111 bytes, SHA-256 `f3bd4d74fb304a878f3b188da7ea22cf4e87e342a8891b42ff23383847b5979b`. [aab-embedded-mapping.json](../../../outputs/v313/signed-candidate5-validation/aab-embedded-mapping.json).

Это статическое сопоставление. ART `GenesisDexVerifier` и запуск MainActivity не выполнялись, поэтому результат не называется startup PASS или проверкой методов на конкретной Android API.

### Источник и границы результата

На проверке HEAD уже `153da56adabd0a40c236d9316e9e1dfe21720576`. `git diff --quiet 597f38e8` по release inputs завершился 0; diff names и status этих путей пусты. Проверены Android main/play/config/Gradle inputs, генерируемые из tracked `app` и `public` ассеты и trial workflow. Последующие debug-host/androidTest/docs изменения не изменили эти release inputs; состав scope и observed status сохранены в [source-scope-check.json](../../../outputs/v313/signed-candidate5-validation/source-scope-check.json). Артефакты относятся именно к source 597f38e8, а не объявляются заново собранными из более позднего HEAD.

Не проверены этим проходом: установка/обновление, сохранность данных на устройстве после установки, startup/ART class verification, 16 KB runtime, OAuth/синхронизация на фактически распространяемой сборке, APK из Google Play и его app-signing certificate, Console acceptance/pre-launch report, публикация сайта или Play. Сертификат upload AAB не подменяет проверку сертификата APK, доставленного Play.

Свод машинных результатов: [validation-summary.json](../../../outputs/v313/signed-candidate5-validation/validation-summary.json). Инвентарь логов/helpers с SHA-256: [evidence-sha256.json](../../../outputs/v313/signed-candidate5-validation/evidence-sha256.json).
