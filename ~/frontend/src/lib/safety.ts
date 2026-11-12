/**
 * 보증금 지키기(전세사기 예방) 안내 콘텐츠.
 * 국토교통부 '전세사기 피해예방 종합안내서'(2025.8)의 안심계약 3·3·3법칙을 기준으로 정리했습니다.
 * 정책·서비스는 바뀔 수 있으므로 계약 전 공식 안내를 다시 확인하도록 안내합니다.
 */

export const OFFICIAL_LINKS = {
  molit_rt: { label: '국토교통부 실거래가 공개시스템', url: 'https://rt.molit.go.kr/' },
  iros: { label: '인터넷등기소', url: 'https://www.iros.go.kr/' },
  vworld: { label: '브이월드 (중개사무소 조회)', url: 'https://www.vworld.kr/' },
  gov24: { label: '정부24', url: 'https://www.gov.kr/' },
}

export type SafetyStep = {
  key: string
  stage: string
  title: string
  items: { title: string; detail: string; where?: (keyof typeof OFFICIAL_LINKS)[]; extra?: string }[]
}

export const RULE_333: SafetyStep[] = [
  {
    key: 'before',
    stage: '계약 전',
    title: '이 집, 계약해도 되는 집인가',
    items: [
      {
        title: '주변 시세를 충분히 조사하기',
        detail: '비슷한 집의 매매가·전세가와 비교하세요. 시세보다 지나치게 싸거나 보증금이 집값에 가까우면 위험 신호예요.',
        where: ['molit_rt'],
        extra: '안심전세 앱에서도 시세와 위험 정보를 볼 수 있어요.',
      },
      {
        title: '등기부등본으로 권리관계 확인하기',
        detail: '갑구에서 소유자와 압류·신탁 여부를, 을구에서 근저당(빚) 금액을 확인하세요.',
        where: ['iros'],
      },
      {
        title: '전세보증보험 가입이 가능한 집인지 문의하기',
        detail: '보증금을 돌려받지 못할 때를 대비하는 보증이에요. 가입 가능 여부를 보증기관에 미리 물어보세요.',
        extra: '주택도시보증공사(HUG) 등 보증기관에 문의',
      },
    ],
  },
  {
    key: 'during',
    stage: '계약 시',
    title: '누구와, 어떤 서류로 계약하는가',
    items: [
      {
        title: '공인중개사가 정상 영업 중인지 확인하기',
        detail: '등록된 중개사무소인지, 중개사가 맞는지 확인하세요.',
        where: ['vworld'],
      },
      {
        title: '계약 상대방 = 등기부상 소유자인지 확인하기',
        detail: '신분증과 등기부를 대조하세요. 대리인이라면 위임장·인감증명서를 확인하고, 보증금은 소유자 명의 계좌로 보내세요.',
      },
      {
        title: '상세한 계약서 사용하기',
        detail: '주택임대차표준계약서 등 내용이 자세한 계약서를 쓰고, 특약(수리 책임 등)을 꼼꼼히 확인하세요.',
      },
    ],
  },
  {
    key: 'after',
    stage: '계약 후',
    title: '내 보증금에 대한 권리 확보하기',
    items: [
      {
        title: '임대차계약 신고 또는 확정일자 받기',
        detail: '계약 후 바로 진행하세요.',
        extra: '보증금이 1,000만 원을 넘는 계약이라면, 계약 후 임대차 시작일 전까지 임대인 동의 없이도 세무서에서 임대인의 미납 국세를 열람할 수 있어요 (열람 사실은 임대인에게 통보돼요).',
        where: ['gov24'],
      },
      {
        title: '잔금 전 등기부 다시 확인하기',
        detail: '계약 이후 근저당이 새로 생기는 등 권리관계가 바뀌지 않았는지 잔금을 보내기 직전에 다시 확인하세요.',
        where: ['iros'],
      },
      {
        title: '이사한 날 바로 전입신고하기',
        detail: '이사 당일 전입신고를 마치세요.',
        where: ['gov24'],
      },
    ],
  },
]

export const RED_FLAGS = [
  { title: '시세보다 눈에 띄게 싸다', detail: '좋은 조건이 아니라, 보증금이 집값에 가까운 위험한 집일 수 있어요.' },
  { title: '등기부에 근저당·압류·신탁이 있다', detail: '집이 경매로 넘어가면 내 보증금이 뒤로 밀릴 수 있어요. 금액과 순서를 꼭 확인하세요.' },
  { title: '집주인이 아닌 사람이 계약하러 나왔다', detail: '대리인이라면 위임장·인감증명서를 확인하고, 소유자와 직접 통화해 보세요.' },
  { title: '소유자가 아닌 계좌로 보내 달라고 한다', detail: '보증금과 계약금은 등기부상 소유자 명의 계좌로 보내세요.' },
  { title: '보증보험 가입이 안 된다고 한다', detail: '가입이 안 되는 이유를 확인하세요. 위험한 집이라는 신호일 수 있어요.' },
  { title: '세금 체납 여부를 확인해 주지 않는다', detail: '체납 세금은 보증금보다 먼저 배당될 수 있어요. 납세증명서를 요청하거나 미납 국세 열람 제도를 이용하세요.' },
  { title: '확인할 시간을 주지 않고 서두르게 한다', detail: '"다른 사람이 계약하려 한다"며 재촉해도 서류 확인은 생략하지 마세요.' },
]

export const SAFETY_SOURCES = [
  { label: '국토교통부 안심계약 3·3·3법칙 (전세사기 피해예방 종합안내서 발간 기사, 2025.8)', url: 'https://newsseoul.co.kr/news/view/1065568216151845' },
  { label: '국토교통부 안심 전세계약 체크리스트 (인천광역시 게시)', url: 'https://www.incheon.go.kr/housing/hou050300/3032389' },
  { label: '토스뱅크 · 전세사기 피해 예방 체크리스트 (국토교통부·경찰청 등 자료 참고)', url: 'https://www.tossbank.com/articles/rental-scam' },
  { label: '노컷뉴스 · 보증금 1천만 원 넘으면 집주인 동의 없이 미납 국세 열람 (기획재정부 발표)', url: 'https://www.nocutnews.co.kr/news/5881623' },
]
