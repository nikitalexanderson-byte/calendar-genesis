# G1: аудит сохранения незавершённого планирования

Исходная версия — master03bec6f (PR #205). Существующий SharedPlanning хранит форму спринта, carry-over choices и замыкания повторных команд только в памяти. После reload неизвестны исходные UUID и тело команды. Права берутся из родительского snapshot, который может быть старым.

В пределах одного экрана сохраняем encrypted device drafts: новую/редактируемую форму спринта, ссылки и решения завершения, точные pending settings/create/edit/start/complete commands. Повтор остаётся явным, с исходным requestId/revision/fingerprint; перед ним нужен свежий read с актуальными правами. Формат не содержит task titles/values, участников, отчётов или cached ACL. Названия задач после recovery доступны только после свежей полной выборки. Явное обновление сохраняет решения только для тех же task revisions и доступных целей.

Используем существующий private workspace key, journal/session guard и оформление Universal UI. Новая UI-библиотека, миграции и writer protocol не нужны. Independent calendar mode/context, ISO dates,0/null, server CAS/receipt/atomic lifecycle сохраняются. G2 оценки строк пока остаются отдельным остатком.

План проверки: реальные reopen/reload/cold offline, lost committed create/start/complete/settings responses с одним UUID, >100 task choices, role downgrade, concurrent edit и fingerprint conflict, storage quota/corruption, две вкладки и CAS;14 языков и обе схемы ×360/390/768/1440. Before snapshots сохранены в output/playwright/planning-durable-before-*.png. Существующие server tests дополняются проверкой минимальных authoritative permissions.
