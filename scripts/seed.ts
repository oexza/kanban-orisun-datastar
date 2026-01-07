import {db} from "~/db";
import {
    users,
    tags,
} from "../drizzle/schema";

const timestamp = (day: number, hour: number, minute = 0) =>
    new Date(Date.UTC(2024, 0, day, hour, minute));

const usersData = [
    {id: "2cd5fecb-eee6-4cd1-8639-1f634b900a3b", name: "Loren"},
    {id: "ce642ef6-6367-406e-82ea-b0236361440f", name: "Alex"},
    {id: "288bc717-a551-4a91-8d9d-444d13addb68", name: "Dolly"},
    {id: "9689b595-abe1-4589-838c-1958aae53a94", name: "Bobby"},
    {id: "6ef2bf51-f656-49ac-843f-5954a6f2a00b", name: "Sofia"},
];

const listTitles = ["Todo", "In-Progress", "QA", "Done"];

const tagsData = [
    {
        id: "bf87f479-2a05-4fe8-8122-22afa5e30141",
        name: "Design",
        color: "#8B5CF6",
        createdAt: timestamp(1, 12),
    }, // Purple
    {
        id: "3b8bff79-df12-4e14-860b-3e2cebe73cff",
        name: "Product",
        color: "#EC4899",
        createdAt: timestamp(1, 13),
    }, // Pink
    {
        id: "68421280-45b2-4276-8e4c-9dfc33a349f0",
        name: "Engineering",
        color: "#3B82F6",
        createdAt: timestamp(1, 14),
    }, // Blue
    {
        id: "14415f32-16aa-4860-87ef-636a7f0dd47f",
        name: "Marketing",
        color: "#10B981",
        createdAt: timestamp(1, 15),
    }, // Green
    {
        id: "828ba03d-c9b4-402c-8165-59cb9f67d30f",
        name: "QA",
        color: "#F59E0B",
        createdAt: timestamp(1, 16),
    }, // Amber
];

const seed = async () => {
    await db.transaction(async (tx) => {
        await tx.delete(tags);
        await tx.delete(users);
        await tx.insert(users).values(usersData);
        await tx.insert(tags).values(tagsData);
    });
};

try {
    seed().then(() => {
        console.log("Database seeded");
        process.exit(0);
    }).catch((error) => {
        console.error(error);
        process.exit(1);
    });
} catch (error) {
    console.error(error);
    process.exit(1);
}
