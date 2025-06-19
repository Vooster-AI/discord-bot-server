import { SlashCommandBuilder } from 'discord.js';
import { supabase, LEVEL_DIVISOR } from '../../utils/supabase';

const getRankEmoji = (rank: number): string => {
    switch (rank) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return '🏅';
    }
};

export default {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('서버 내 상위 10명의 랭킹을 확인합니다'),
    
    async execute(interaction: any) {
        try {
            const { data: users, error } = await supabase
                .from('Users')
                .select('name, score')
                .not('score', 'is', null)
                .gt('score', 0)
                .order('score', { ascending: false })
                .limit(10);

            if (error) {
                console.error('Supabase error:', error);
                await interaction.reply('❌ 랭킹 조회 중 오류가 발생했습니다.');
                return;
            }

            if (!users || users.length === 0) {
                await interaction.reply('📊 **서버 랭킹**\n점수가 있는 등록된 사용자가 없습니다.');
                return;
            }

            const rankingText = users.map((user, index) => {
                const rank = index + 1;
                const level = Math.floor(user.score / LEVEL_DIVISOR);
                const emoji = getRankEmoji(rank);
                
                return `${emoji} **${rank}위** - **${user.name}**\n┗ Lv.${level} (${user.score}점)`;
            }).join('\n\n');

            const embed = {
                color: 0xFFD700,
                title: '🏆 서버 랭킹 TOP 10',
                description: rankingText,
                footer: {
                    text: '포럼 활동으로 점수를 얻어 랭킹을 올려보세요!'
                },
                timestamp: new Date().toISOString()
            };

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Rank command error:', error);
            await interaction.reply('❌ 랭킹 조회 중 오류가 발생했습니다.');
        }
    }
};