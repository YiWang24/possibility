-- 兼容已部署和最新 main 的触发器函数命名，收紧 search_path / execute 权限。
do $$
declare
  function_name text;
begin
  foreach function_name in array array[
    'public.set_updated_at()',
    'public.touch_updated_at()',
    'public.handle_new_user()'
  ]
  loop
    if to_regprocedure(function_name) is not null then
      execute format('alter function %s set search_path = %L', function_name, '');
      execute format(
        'revoke all on function %s from public, anon, authenticated',
        function_name
      );
    end if;
  end loop;
end
$$;
