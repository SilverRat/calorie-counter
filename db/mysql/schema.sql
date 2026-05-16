create table if not exists users (
  id char(36) primary key,
  email varchar(255) not null,
  password_hash varchar(255) not null,
  role varchar(32) not null default 'user',
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  unique key users_email_uniq (email)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists food_entries (
  id char(36) primary key,
  user_id char(36) not null,
  occurred_at datetime(3) not null,
  meal_type enum('breakfast','lunch','dinner','snack') not null,
  item_name varchar(160) not null,
  calories int not null,
  protein int null,
  carbs int null,
  fat int null,
  source enum('user','llm_text','llm_image') not null default 'user',
  confidence double null,
  notes varchar(500) null,
  provenance json null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  constraint food_entries_user_fk foreign key (user_id) references users(id) on delete cascade,
  key food_entries_user_date_idx (user_id, occurred_at desc)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists chat_sessions (
  id char(36) primary key,
  user_id char(36) not null,
  title varchar(120) not null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  archived_at datetime(3) null,
  constraint chat_sessions_user_fk foreign key (user_id) references users(id) on delete cascade,
  key chat_sessions_user_updated_idx (user_id, updated_at desc)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists chat_messages (
  id char(36) primary key,
  session_id char(36) not null,
  user_id char(36) not null,
  role enum('system','user','assistant','tool') not null,
  content text not null,
  has_image boolean not null default false,
  tool_name varchar(120) null,
  tool_args_json json null,
  tool_result_json json null,
  created_at datetime(3) not null default current_timestamp(3),
  constraint chat_messages_session_fk foreign key (session_id) references chat_sessions(id) on delete cascade,
  constraint chat_messages_user_fk foreign key (user_id) references users(id) on delete cascade,
  key chat_messages_session_created_idx (session_id, created_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists prompts (
  id char(36) primary key,
  name varchar(120) not null,
  version int not null,
  system_text text not null,
  metadata_json json null,
  is_active boolean not null default false,
  created_at datetime(3) not null default current_timestamp(3),
  unique key prompts_name_version_uniq (name, version)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
