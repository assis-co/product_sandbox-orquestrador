import { supabase } from './supabaseClient.js';

export async function getChatsByCompany(companyId) {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));

  const todayMidnightUnix = Math.floor(todayMidnight.getTime() / 1000);
  const twoHoursAgoUnix = Math.floor(twoHoursAgo.getTime() / 1000);

  function getDayUnixRange(daysAgo) {
    const day = new Date();
    day.setDate(day.getDate() - daysAgo);
    day.setHours(0, 0, 0, 0);
    const dayStartUnix = Math.floor(day.getTime() / 1000);

    day.setHours(23, 59, 59, 999);
    const dayEndUnix = Math.floor(day.getTime() / 1000);

    return { dayStartUnix, dayEndUnix };
  }

  const { dayStartUnix: threeStart, dayEndUnix: threeEnd } = getDayUnixRange(3);
  const { dayStartUnix: sevenStart, dayEndUnix: sevenEnd } = getDayUnixRange(7);
  const { dayStartUnix: fifteenStart, dayEndUnix: fifteenEnd } = getDayUnixRange(15);

  const { data, error } = await supabase
    .from('chats')
    .select('id, company_id, chat_id, contact_phone, last_message_time, last_buyer_message_time, last_seller_message_time, created_at, total_ignored_fups')
    .eq('company_id', companyId)
    .not('last_deal_created', 'is', null)
    .or(
      [
        `and(last_message_time.gte.${todayMidnightUnix},last_message_time.lte.${twoHoursAgoUnix})`,
        `and(last_message_time.gte.${threeStart},last_message_time.lte.${threeEnd})`,
        `and(last_message_time.gte.${sevenStart},last_message_time.lte.${sevenEnd})`,
        `and(last_message_time.gte.${fifteenStart},last_message_time.lte.${fifteenEnd})`
      ].join(',')
    )
    .order('last_message_time', { ascending: false });

  if (error) {
    console.error('Erro ao buscar chats:', error);
    throw error;
  }

  return data;
}
