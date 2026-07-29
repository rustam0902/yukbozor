import { Order, User, Profile } from '@shared/schema';
import crypto from 'crypto';

export interface ContractData {
  order: Order;
  customer: User;
  customerProfile: Profile | null;
  carrier: User;
  carrierProfile: Profile | null;
  contractNumber: string;
  contractDate: Date;
}

export function generateContractContent(data: ContractData): string {
  const {
    order,
    customer,
    customerProfile,
    carrier,
    carrierProfile,
    contractNumber,
    contractDate,
  } = data;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const getTransportTypeName = (type: string) => {
    const types: Record<string, string> = {
      labo: 'Лабо',
      bongo: 'Бонго',
      furgon: 'Фургон',
      isuzu5: 'Исузу 5т',
      isuzu10: 'Исузу 10т',
      gruzovik: 'Грузовик',
      fura_tent: 'Фура тент',
      fura_ref: 'Фура реф',
      paravoz: 'Паровоз',
      shalanda: 'Шаланда',
      traller: 'Траллер',
    };
    return types[type] || type;
  };


  const customerName = customer.userType === 'individual'
    ? customer.displayName
    : (customerProfile?.companyName || customer.displayName);

  const carrierName = carrier.userType === 'individual'
    ? carrier.displayName
    : (carrierProfile?.companyName || carrier.displayName);

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Договор перевозки груза №${contractNumber}</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            font-size: 14px;
        }
        h1 {
            text-align: center;
            font-size: 18px;
            margin-bottom: 10px;
        }
        h2 {
            font-size: 16px;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .parties {
            margin-bottom: 20px;
        }
        .party {
            margin-bottom: 15px;
        }
        .party-title {
            font-weight: bold;
            margin-bottom: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        table td {
            padding: 8px;
            border: 1px solid #000;
        }
        .signatures {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
        }
        .signature-block {
            width: 45%;
        }
        .signature-line {
            margin-top: 30px;
            border-bottom: 1px solid #000;
            width: 100%;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>ДОГОВОР ПЕРЕВОЗКИ ГРУЗА</h1>
        <p>№ ${contractNumber} от ${formatDate(contractDate)}</p>
        <p>г. Ташкент</p>
    </div>

    <div class="parties">
        <div class="party">
            <div class="party-title">Заказчик (Грузоотправитель):</div>
            <p><strong>${customerName}</strong></p>
            ${customer.userType !== 'individual' ? `<p>ИНН: ${customerProfile?.inn || 'н/у'}</p>` : ''}
            ${customer.userType === 'individual' && customerProfile?.passportSeries ? 
              `<p>Паспорт: ${customerProfile.passportSeries}${customerProfile.passportNumber}</p>` : ''}
            <p>Телефон: ${customer.phone}</p>
            ${customer.email ? `<p>Email: ${customer.email}</p>` : ''}
            ${customerProfile?.bankAccount ? `<p>Р/с: ${customerProfile.bankAccount}</p>` : ''}
            ${customerProfile?.bankName ? `<p>Банк: ${customerProfile.bankName}</p>` : ''}
        </div>

        <div class="party">
            <div class="party-title">Перевозчик (Грузоперевозчик):</div>
            <p><strong>${carrierName}</strong></p>
            ${carrier.userType !== 'individual' ? `<p>ИНН: ${carrierProfile?.inn || 'н/у'}</p>` : ''}
            ${carrier.userType === 'individual' && carrierProfile?.passportSeries ? 
              `<p>Паспорт: ${carrierProfile.passportSeries}${carrierProfile.passportNumber}</p>` : ''}
            <p>Телефон: ${carrier.phone}</p>
            ${carrier.email ? `<p>Email: ${carrier.email}</p>` : ''}
            ${carrierProfile?.bankAccount ? `<p>Р/с: ${carrierProfile.bankAccount}</p>` : ''}
            ${carrierProfile?.bankName ? `<p>Банк: ${carrierProfile.bankName}</p>` : ''}
        </div>
    </div>

    <h2>1. ПРЕДМЕТ ДОГОВОРА</h2>
    <p>1.1. Заказчик поручает, а Перевозчик принимает на себя обязательство осуществить перевозку груза по следующему маршруту:</p>
    <table>
        <tr>
            <td><strong>Пункт отправления:</strong></td>
            <td>${order.originRegion}, ${order.originDistrict}</td>
        </tr>
        <tr>
            <td><strong>Пункт назначения:</strong></td>
            <td>${order.destinationRegion}, ${order.destinationDistrict}</td>
        </tr>
        <tr>
            <td><strong>Наименование груза:</strong></td>
            <td>${order.title}</td>
        </tr>
        <tr>
            <td><strong>Вес груза:</strong></td>
            <td>${order.weightTons} тонн</td>
        </tr>
        <tr>
            <td><strong>Тип транспорта:</strong></td>
            <td>${getTransportTypeName(order.transportType)}</td>
        </tr>
        ${order.loadingTime ? `
        <tr>
            <td><strong>Время погрузки:</strong></td>
            <td>${order.loadingTime}</td>
        </tr>
        ` : ''}
        ${order.loadDate ? `
        <tr>
            <td><strong>Дата погрузки:</strong></td>
            <td>${formatDate(new Date(order.loadDate))}</td>
        </tr>
        ` : ''}
    </table>

    <h2>2. СТОИМОСТЬ УСЛУГ И ПОРЯДОК РАСЧЕТОВ</h2>
    <p>2.1. Стоимость услуг по перевозке груза составляет: <strong>${order.priceWithVat.toLocaleString('ru-RU')} сум</strong> (${customerProfile?.ndsPayer ? 'включая НДС' : 'без НДС'}).</p>
    <p>2.2. Форма оплаты: Банковский перевод.</p>
    <p>2.3. Оплата производится после успешного завершения перевозки и подписания акта приема-передачи груза.</p>

    <h2>3. ПРАВА И ОБЯЗАННОСТИ СТОРОН</h2>
    <p><strong>3.1. Заказчик обязуется:</strong></p>
    <ul>
        <li>Обеспечить своевременную подачу груза для перевозки;</li>
        <li>Предоставить Перевозчику необходимые документы на груз;</li>
        <li>Произвести оплату услуг в соответствии с условиями настоящего договора;</li>
        <li>Обеспечить разгрузку груза в пункте назначения.</li>
    </ul>

    <p><strong>3.2. Перевозчик обязуется:</strong></p>
    <ul>
        <li>Принять груз к перевозке и обеспечить его сохранность;</li>
        <li>Доставить груз в пункт назначения в установленные сроки;</li>
        <li>Выдать груз получателю в исправном состоянии;</li>
        <li>Предоставить исправный транспорт, соответствующий типу и характеру груза.</li>
    </ul>

    <h2>4. ОТВЕТСТВЕННОСТЬ СТОРОН</h2>
    <p>4.1. За неисполнение или ненадлежащее исполнение обязательств по настоящему договору стороны несут ответственность в соответствии с действующим законодательством Республики Узбекистан.</p>
    <p>4.2. Перевозчик несет ответственность за сохранность груза с момента его принятия до момента выдачи получателю.</p>
    <p>4.3. В случае утраты, недостачи или повреждения груза Перевозчик возмещает Заказчику причиненный ущерб.</p>

    <h2>5. ПОРЯДОК РАЗРЕШЕНИЯ СПОРОВ</h2>
    <p>5.1. Все споры и разногласия, возникающие из настоящего договора или в связи с ним, разрешаются путем переговоров между сторонами.</p>
    <p>5.2. В случае недостижения согласия спор передается на рассмотрение в Экономический суд Республики Узбекистан.</p>

    <h2>6. СРОК ДЕЙСТВИЯ ДОГОВОРА</h2>
    <p>6.1. Настоящий договор вступает в силу с момента его подписания обеими сторонами и действует до полного исполнения сторонами своих обязательств.</p>

    <h2>7. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ</h2>
    <p>7.1. Настоящий договор составлен в двух экземплярах, имеющих одинаковую юридическую силу, по одному для каждой из сторон.</p>
    <p>7.2. Все изменения и дополнения к настоящему договору действительны лишь при условии, что они совершены в письменной форме и подписаны обеими сторонами.</p>

    ${order.notes ? `
    <h2>8. ДОПОЛНИТЕЛЬНЫЕ УСЛОВИЯ</h2>
    <p>${order.notes}</p>
    ` : ''}

    <h2>${order.notes ? '9' : '8'}. ПОРЯДОК ПОДПИСАНИЯ ДОГОВОРА</h2>
    <p>${order.notes ? '9' : '8'}.1. В соответствии с Законом Республики Узбекистан «Об электронной цифровой подписи» и условиями Публичной оферты платформы Yukbozor.uz, настоящий договор заключен в электронной форме.</p>
    <p>${order.notes ? '9' : '8'}.2. При регистрации на платформе Yukbozor.uz Стороны приняли условия Публичной оферты и подтвердили своё согласие на автоматическое подписание всех будущих договоров перевозки путём:</p>
    <ul>
        <li>Для юридических лиц и ИП — подписания Публичной оферты с использованием электронной цифровой подписи (ЭЦП) E-IMZO;</li>
        <li>Для физических лиц — подтверждения согласия с условиями Публичной оферты посредством SMS-кода.</li>
    </ul>
    <p>${order.notes ? '9' : '8'}.3. <strong>Юридическая формула принятия оферты:</strong> Совершение конклюдентных действий (размещение заказа Заказчиком или подача предложения Перевозчиком) признаётся акцептом Публичной оферты и влечёт автоматическое заключение настоящего договора на условиях, изложенных в оферте и в настоящем договоре.</p>
    <p>${order.notes ? '9' : '8'}.4. Настоящий договор подписан электронными подписями Сторон, зарегистрированными при принятии условий Публичной оферты:</p>

    <table>
        <tr>
            <td colspan="2" style="text-align: center; font-weight: bold;">Сведения о подтверждении Заказчика</td>
        </tr>
        ${customer.userType !== 'individual' && customerProfile?.eimzoCertSerial ? `
        <tr>
            <td><strong>Серийный номер сертификата:</strong></td>
            <td>${customerProfile.eimzoCertSerial}</td>
        </tr>
        <tr>
            <td><strong>Владелец сертификата (CN):</strong></td>
            <td>${customerProfile.eimzoCertCn || 'н/у'}</td>
        </tr>
        <tr>
            <td><strong>Организация (O):</strong></td>
            <td>${customerProfile.eimzoCertO || 'н/у'}</td>
        </tr>
        <tr>
            <td><strong>ИНН/ПИНФЛ:</strong></td>
            <td>${customerProfile.eimzoCertTin || customerProfile.eimzoCertPinfl || 'н/у'}</td>
        </tr>
        <tr>
            <td><strong>Срок действия:</strong></td>
            <td>${customerProfile.eimzoCertValidFrom ? formatDate(new Date(customerProfile.eimzoCertValidFrom)) : '?'} — ${customerProfile.eimzoCertValidTo ? formatDate(new Date(customerProfile.eimzoCertValidTo)) : '?'}</td>
        </tr>
        <tr>
            <td><strong>Дата принятия оферты:</strong></td>
            <td>${customerProfile.offerAcceptedAt ? formatDate(new Date(customerProfile.offerAcceptedAt)) : 'н/у'}</td>
        </tr>
        ` : `
        <tr>
            <td><strong>Способ подтверждения:</strong></td>
            <td>SMS-верификация при регистрации</td>
        </tr>
        <tr>
            <td><strong>ПИНФЛ:</strong></td>
            <td>${customerProfile?.pinfl || 'н/у'}</td>
        </tr>
        <tr>
            <td><strong>Паспорт:</strong></td>
            <td>${customerProfile?.passportSeries ? customerProfile.passportSeries + customerProfile.passportNumber : 'н/у'}</td>
        </tr>
        <tr>
            <td><strong>Дата принятия оферты:</strong></td>
            <td>${customerProfile?.offerAcceptedAt ? formatDate(new Date(customerProfile.offerAcceptedAt)) : 'н/у'}</td>
        </tr>
        `}
    </table>

    <table style="margin-top: 15px;">
        <tr>
            <td colspan="2" style="text-align: center; font-weight: bold;">Сведения о подтверждении Перевозчика</td>
        </tr>
        ${carrier.userType !== 'individual' && carrierProfile?.eimzoCertSerial ? `
        <tr>
            <td><strong>Серийный номер сертификата:</strong></td>
            <td>${carrierProfile.eimzoCertSerial}</td>
        </tr>
        <tr>
            <td><strong>Владелец сертификата (CN):</strong></td>
            <td>${carrierProfile.eimzoCertCn || 'н/у'}</td>
        </tr>
        <tr>
            <td><strong>Организация (O):</strong></td>
            <td>${carrierProfile.eimzoCertO || 'н/у'}</td>
        </tr>
        <tr>
            <td><strong>ИНН/ПИНФЛ:</strong></td>
            <td>${carrierProfile.eimzoCertTin || carrierProfile.eimzoCertPinfl || 'н/у'}</td>
        </tr>
        <tr>
            <td><strong>Срок действия:</strong></td>
            <td>${carrierProfile.eimzoCertValidFrom ? formatDate(new Date(carrierProfile.eimzoCertValidFrom)) : '?'} — ${carrierProfile.eimzoCertValidTo ? formatDate(new Date(carrierProfile.eimzoCertValidTo)) : '?'}</td>
        </tr>
        <tr>
            <td><strong>Дата принятия оферты:</strong></td>
            <td>${carrierProfile.offerAcceptedAt ? formatDate(new Date(carrierProfile.offerAcceptedAt)) : 'н/у'}</td>
        </tr>
        ` : `
        <tr>
            <td><strong>Способ подтверждения:</strong></td>
            <td>SMS-верификация при регистрации</td>
        </tr>
        <tr>
            <td><strong>ПИНФЛ:</strong></td>
            <td>${carrierProfile?.pinfl || 'н/у'}</td>
        </tr>
        <tr>
            <td><strong>Паспорт:</strong></td>
            <td>${carrierProfile?.passportSeries ? carrierProfile.passportSeries + carrierProfile.passportNumber : 'н/у'}</td>
        </tr>
        <tr>
            <td><strong>Дата принятия оферты:</strong></td>
            <td>${carrierProfile?.offerAcceptedAt ? formatDate(new Date(carrierProfile.offerAcceptedAt)) : 'н/у'}</td>
        </tr>
        `}
    </table>

    <div class="signatures">
        <div class="signature-block">
            <p><strong>Заказчик:</strong></p>
            <p>${customerName}</p>
            ${customer.userType !== 'individual' && customerProfile?.eimzoCertCn ? 
              `<p style="font-size: 12px; color: #666;">Подписано ЭЦП: ${customerProfile.eimzoCertCn}</p>` : 
              `<p style="font-size: 12px; color: #666;">Подтверждено при регистрации (SMS): ${customerProfile?.offerAcceptedAt ? formatDate(new Date(customerProfile.offerAcceptedAt)) : 'н/у'}</p>`
            }
        </div>
        <div class="signature-block">
            <p><strong>Перевозчик:</strong></p>
            <p>${carrierName}</p>
            ${carrier.userType !== 'individual' && carrierProfile?.eimzoCertCn ? 
              `<p style="font-size: 12px; color: #666;">Подписано ЭЦП: ${carrierProfile.eimzoCertCn}</p>` : 
              `<p style="font-size: 12px; color: #666;">Подтверждено при регистрации (SMS): ${carrierProfile?.offerAcceptedAt ? formatDate(new Date(carrierProfile.offerAcceptedAt)) : 'н/у'}</p>`
            }
        </div>
    </div>
</body>
</html>
  `.trim();
}

export function generateDocumentHash(content: string): string {
  // Generate SHA-256 hash for document integrity verification
  return crypto.createHash('sha256').update(content).digest('hex');
}
