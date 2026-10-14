insert into topics(name,category) values('Education','learning'),('Cricket','sport'),('Technology','technology'),('Arts','culture') on conflict do nothing;
insert into events(title,category,region,starts_at) values('Community learning live','education','India',now());
