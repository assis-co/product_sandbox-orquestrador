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

  const fourteenDaysAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
  const fourteenDaysAgoUnix = Math.floor(fourteenDaysAgo.getTime() / 1000);

  const { dayStartUnix: threeStart, dayEndUnix: threeEnd } = getDayUnixRange(3);
  const { dayStartUnix: sevenStart, dayEndUnix: sevenEnd } = getDayUnixRange(7);
  const { dayStartUnix: fifteenStart, dayEndUnix: fifteenEnd } = getDayUnixRange(15);

  const { data, error } = await supabase
    .from('chats')
    .select('id, company_id, chat_id, contact_phone, last_message_time, last_buyer_message_time, last_seller_message_time, created_at, total_ignored_fups')
    .eq('company_id', companyId)
    .or(
      [
        `last_buyer_message_time.gte.${fourteenDaysAgoUnix}`,
        `and(last_buyer_message_time.is.null,last_message_time.gte.${fourteenDaysAgoUnix})`
      ].join(',')
    )
    .order('last_message_time', { ascending: false });

  if (error) {
    console.error('Erro ao buscar chats:', error);
    throw error;
  }

  return data;
}
