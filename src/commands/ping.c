#include <stdio.h>
#include <orca/discord.h>

void ping(struct discord *client, const struct discord_user *user, const struct discord_message *msg) {
    if (msg->author->bot) return;

    struct discord_create_message_params params = {.content = "pong"};
    discord_create_message(client, msg->channel_id, &params, NULL);
    printf("%s\n", params.content);
}