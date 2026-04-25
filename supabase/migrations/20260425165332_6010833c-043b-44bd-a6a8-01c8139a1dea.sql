-- Allow staff to access their owner's classes
CREATE POLICY "Staff manages owner classes" ON public.classes
FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));

-- Allow staff to access their owner's students
CREATE POLICY "Staff manages owner students" ON public.students
FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));