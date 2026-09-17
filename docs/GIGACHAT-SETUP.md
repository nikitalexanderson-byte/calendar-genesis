# Разовая настройка GigaChat для GENESIS Voice

GigaChat выбран основным нейросетевым provider для российского домена и Beget. В браузер передаётся только признак доступности помощника; секретный ключ остаётся в закрытом `server/config.php`. Access token действует ограниченное время, но GENESIS получает и обновляет его автоматически.

## 1. Создать ключ

1. Войдите в [личный кабинет GigaChat API](https://developers.sber.ru/portal/products/gigachat-api).
2. Создайте проект GigaChat API для физического лица и включите Freemium-режим.
3. Откройте «Настройки API» и скопируйте **Authorization Key**. Не публикуйте его, не добавляйте в Git и не присылайте в чат.

Официальная пошаговая инструкция: [быстрый старт для физических лиц](https://developers.sber.ru/docs/ru/gigachat/individuals-quickstart).

## 2. Один раз добавить ключ на Beget

Откройте закрытый файл:

```text
/home/h/haiirodw/genesis-calendar/server/config.php
```

Добавьте или замените параметры внутри возвращаемого PHP-массива:

```php
'gigachat_enabled' => true,
'gigachat_authorization_key' => 'ВАШ_AUTHORIZATION_KEY',
'gigachat_scope' => 'GIGACHAT_API_PERS',
'gigachat_model' => 'GigaChat',
'gigachat_auth_endpoint' => 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
'gigachat_api_endpoint' => 'https://api.giga.chat/v1',
'gigachat_ca_path' => '',
```

Не заменяйте остальные параметры конфигурации. CI/CD сохраняет этот server-only файл при последующих деплоях, поэтому повторно вводить ключ не потребуется.

## 3. Проверить

После сохранения перезагрузите GENESIS и нажмите основной микрофон. Должно открыться окно `GENESIS Voice · GigaChat` с кнопкой записи. Произнесите, например:

> Создай задачу позвонить врачу завтра в 18 часов и помести её в проект Здоровье.

Сначала появится черновик. Проверьте название, дату, время и проект, затем подтвердите создание.

Если интерфейс сообщает об ошибке сертификата, установите на сервер сертификаты НУЦ Минцифры по [официальной инструкции GigaChat](https://developers.sber.ru/docs/ru/gigachat/certificates) и укажите абсолютный путь к CA-bundle в `gigachat_ca_path`. Отключать проверку TLS не следует.
