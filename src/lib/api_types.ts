import {Hono} from "hono";
import {Session} from "hono-sessions";

export type SessionDataTypes = {
    session_id: string;
};

export type HonoContextType = {
    Variables: {
        session: Session<SessionDataTypes>;
        session_key_rotation: boolean;
    };
};

export type HonoType = Hono<HonoContextType>