#include <orca/discord.h>
#include "../libs/bot_include.h"

void update(struct discord *client, const struct discord_user *bot, const struct discord_message *msg) {
    if (msg->author->bot) return;

    char *author_avatar_url = malloc(AVATAR_URL_LEN), *owner_role_mention = malloc(ROLE_MENTION_LEN);
    struct discord_guild *guild = discord_guild_alloc();
    struct discord_guild_member *guild_member = discord_guild_member_alloc();
    struct discord_embed *embed = discord_embed_alloc();
    struct discord_create_message_params params = {.embed = embed};

    embed->timestamp = msg->timestamp;
    role_mention(owner_role_mention, R_OWNER);
    get_avatar_url(author_avatar_url, msg->author);
    snprintf(embed->footer->text, sizeof(embed->footer->text), "Author ID: %lu", msg->author->id);
    discord_embed_set_author(embed, msg->author->username, NULL, author_avatar_url, NULL);
    discord_get_guild_member(client, msg->guild_id, msg->author->id, guild_member);

    if (!guild_member_has_role(guild_member, R_OWNER)) {
        embed->color = COLOR_RED;
        snprintf(embed->title, sizeof(embed->title), "No permission!");
        discord_embed_add_field(embed, "Required role", owner_role_mention, true);

        discord_create_message(client, msg->channel_id, &params, NULL);

        free(author_avatar_url);
        free(owner_role_mention);
        discord_guild_member_free(guild_member);
        discord_guild_free(guild);
        discord_embed_free(embed);
    }
    else {
        embed->color = COLOR_MINT;
        snprintf(embed->title, sizeof(embed->title), "Updating...");
        snprintf(embed->description, sizeof(embed->description), "Please wait a brief moment...");

        discord_create_message(client, msg->channel_id, &params, NULL);

        system("git pull");

        free(author_avatar_url);
        free(owner_role_mention);
        discord_guild_member_free(guild_member);
        discord_guild_free(guild);
        discord_embed_free(embed);
        discord_cleanup(client);
        discord_global_cleanup();
    }

    return;
}
