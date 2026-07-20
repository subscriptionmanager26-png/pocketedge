import { ensureSupabase } from './supabase';
import { bootstrapSocialApp, ensureSocialProfile } from './socialProfileApi';
import { isProductionApp } from './appMode';
import { flushDemoLocalData } from './flushDemoLocalData';
import { writeCachedFeedPosts, readCachedFeedPosts } from './feedCache';
import { readCachedBootstrap, writeCachedBootstrap } from './bootstrapCache';
import { consumeBootPayload } from './bootPayload';
import { markBootstrapDone } from './perfMarks';
import { prefetchAppTabData } from './tabPrefetch';
import {
  fetchFeedPosts,
  mapPostRow,
  notePostLikeSynced,
  usePostBackend,
} from './socialPostApi';
import {
  getMyRecentFollowerEvents,
  hydrateMyFollowing,
} from './socialGraphStore';
import { resolvePeople, warmPostAuthors } from './socialIdentity';

function mapFeedItems(feed) {
  return (feed?.items ?? []).map((row) => {
    const post = mapPostRow(row);
    notePostLikeSynced(post.id, post.liked);
    return post;
  });
}

/**
 * Runs profile + feed bootstrap after auth. Returns a cancel function.
 */
export function startAppBootstrap({
  authUserId,
  cancelledRef,
  setSocialProfile,
  setSelfProfile,
  setProfileReady,
  setPosts,
  setPostsLoading,
}) {
  const bootCache = readCachedBootstrap();
  const hasCachedProfile = Boolean(bootCache?.profile);
  const hasCachedFeed =
    (bootCache?.posts?.length ?? 0) > 0 || (readCachedFeedPosts()?.length ?? 0) > 0;

  if (!hasCachedProfile) setProfileReady(false);
  if (!hasCachedFeed) setPostsLoading(true);

  if (bootCache?.profile) {
    setSocialProfile(bootCache.profile);
    setSelfProfile(bootCache.profile);
    setProfileReady(true);
    hydrateMyFollowing()
      .then(() => {
        const followerIds = getMyRecentFollowerEvents().map((event) => event.followerId);
        if (followerIds.length) return resolvePeople(followerIds);
        return null;
      })
      .catch(() => {});
  }

  if (bootCache?.posts?.length) {
    warmPostAuthors(bootCache.posts)
      .catch(() => {})
      .finally(() => {
        if (cancelledRef.current) return;
        setPosts(bootCache.posts);
        setPostsLoading(false);
      });
  }

  const applyProfile = (profile) => {
    if (cancelledRef.current) return;
    if (isProductionApp()) flushDemoLocalData();
    setSocialProfile(profile);
    setSelfProfile(profile);
    setProfileReady(true);
    hydrateMyFollowing()
      .then(() => {
        const followerIds = getMyRecentFollowerEvents().map((event) => event.followerId);
        if (followerIds.length) return resolvePeople(followerIds);
        return null;
      })
      .catch(() => {});
  };

  const applyFeed = async (items, profileForCache) => {
    if (cancelledRef.current) return;
    await warmPostAuthors(items).catch(() => {});
    if (cancelledRef.current) return;
    setPosts(items);
    writeCachedFeedPosts(items);
    if (profileForCache) {
      writeCachedBootstrap({ profile: profileForCache, posts: items });
    }
    setPostsLoading(false);
    markBootstrapDone('network');
  };

    const runBootstrap = async () => {
      await ensureSupabase();
      const edgeBoot = await consumeBootPayload();
    if (edgeBoot?.profile) {
      applyProfile(edgeBoot.profile);
      await applyFeed(mapFeedItems(edgeBoot.feed), edgeBoot.profile);
      markBootstrapDone('edge');
      prefetchAppTabData(authUserId);
      return;
    }

    if (!usePostBackend()) {
      try {
        const profile = await ensureSocialProfile();
        applyProfile(profile);
        writeCachedBootstrap({ profile, posts: readCachedFeedPosts() ?? [] });
        markBootstrapDone('local');
      } catch {
        if (!cancelledRef.current) {
          setSocialProfile(null);
          setSelfProfile(null);
          setProfileReady(true);
        }
      }
      setPostsLoading(false);
      prefetchAppTabData(authUserId);
      return;
    }

    try {
      const { profile, feed } = await bootstrapSocialApp({ feedLimit: 50 });
      applyProfile(profile);
      await applyFeed(mapFeedItems(feed), profile);
    } catch {
      let profile = null;
      try {
        profile = await ensureSocialProfile();
        applyProfile(profile);
      } catch {
        if (!cancelledRef.current) {
          setSocialProfile(null);
          setSelfProfile(null);
          setProfileReady(true);
        }
      }
      try {
        const items = await fetchFeedPosts();
        await applyFeed(items, profile);
      } catch {
        await applyFeed([], profile);
      }
    }
    prefetchAppTabData(authUserId);
  };

  runBootstrap();
}
