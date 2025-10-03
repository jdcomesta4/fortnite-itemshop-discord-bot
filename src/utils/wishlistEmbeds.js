const { EmbedBuilder } = require('discord.js');

function formatType(type) {
    if (!type) return 'Unknown';
    if (typeof type === 'object') {
        return type.displayValue || type.value || type.name || 'Unknown';
    }
    return type
        .toString()
        .replace(/_/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatRarity(rarity) {
    if (!rarity) return 'Unknown';
    const value = typeof rarity === 'object'
        ? rarity.displayValue || rarity.value || rarity.name
        : rarity;

    if (!value) return 'Unknown';

    return value
        .toString()
        .replace(/_/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatPrice(price) {
    if (price === null || price === undefined) return 'Unknown';

    let numeric;
    if (typeof price === 'string') {
        const digits = price.replace(/[^0-9]/g, '');
        numeric = digits ? parseInt(digits, 10) : NaN;
    } else {
        numeric = Number(price);
    }

    if (!Number.isFinite(numeric) || numeric <= 0) {
        return 'Unknown';
    }

    return `${numeric.toLocaleString()} V-Bucks`;
}

function createWishlistConfirmationEmbed(item, options = {}) {
    const {
        title = '✅ Added to Wishlist',
        description,
        viewCommand = '/mywishlist',
        footerText,
        footerIcon
    } = options;

    const itemName = item?.name || 'Unknown Item';
    const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(title)
        .setTimestamp();

    const defaultDescription = `➕ **${itemName}** has been added to your wishlist!${viewCommand ? `\n\nUse \`${viewCommand}\` to view your complete wishlist.` : ''}`;
    embed.setDescription(description ?? defaultDescription);

    if (item?.icon_url) {
        embed.setThumbnail(item.icon_url);
    }

    embed.addFields(
        { name: '🏷️ Type', value: formatType(item?.type), inline: true },
        { name: '💠 Rarity', value: formatRarity(item?.rarity), inline: true },
        { name: '💎 Price', value: formatPrice(item?.price), inline: true }
    );

    if (footerText) {
        embed.setFooter({ text: footerText, iconURL: footerIcon ?? null });
    }

    return embed;
}

module.exports = {
    createWishlistConfirmationEmbed,
    formatType,
    formatRarity,
    formatPrice
};
